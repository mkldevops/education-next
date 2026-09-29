import { NextResponse } from 'next/server'

/**
 * Réponses des points de terminaison OAuth, au format de RFC 6749 §5.2.
 *
 * `Cache-Control: no-store` est exigé sur tout ce qui porte un jeton. Les origines sont
 * ouvertes : rien ici n'est authentifié par cookie, la preuve est PKCE, et un client MCP
 * dans un navigateur (inspecteur, client web) doit pouvoir découvrir puis échanger.
 */
const OAUTH_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version',
} as const

export function oauthJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: OAUTH_HEADERS })
}

export function oauthError(error: string, status = 400, description?: string) {
  return oauthJson(
    description === undefined ? { error } : { error, error_description: description },
    status
  )
}

export function oauthPreflight() {
  return new NextResponse(null, { status: 204, headers: OAUTH_HEADERS })
}

const MAX_BODY_BYTES = 16 * 1024

/** Un `Content-Length` annoncé au-delà de la borne est refusé avant de lire quoi que ce soit. */
async function readBoundedBody(request: Request): Promise<string | null> {
  const announced = Number(request.headers.get('content-length'))
  if (Number.isFinite(announced) && announced > MAX_BODY_BYTES) return null
  const raw = await request.text()
  return raw.length > MAX_BODY_BYTES ? null : raw
}

/**
 * Corps `application/x-www-form-urlencoded` (le format des RFC) ou JSON (ce que RFC
 * 7591 prescrit pour l'enregistrement), lu une fois, borné, aplati en chaînes.
 *
 * `null` couvre un corps illisible, trop long ou d'un autre type : la route répond
 * `invalid_request` sans distinguer.
 */
export async function readOAuthBody(
  request: Request
): Promise<Record<string, string | undefined> | null> {
  const contentType = request.headers.get('content-type') ?? ''
  const raw = await readBoundedBody(request)
  if (raw === null) return null

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw))
  }

  if (contentType.includes('application/json')) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [
          key,
          typeof value === 'string' ? value : undefined,
        ])
      )
    } catch {
      return null
    }
  }

  return null
}

/** Même lecture, mais les tableaux survivent : l'enregistrement en a besoin. */
export async function readOAuthJson(request: Request): Promise<unknown> {
  const raw = await readBoundedBody(request)
  if (raw === null) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
