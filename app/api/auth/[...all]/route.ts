import { toNextJsHandler } from 'better-auth/next-js'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isGoogleSignInEnabled } from '@/use-cases/platform-settings/is-google-sign-in-enabled'

const handler = toNextJsHandler(auth)

const BASE_PATH = '/api/auth'

// Google est le seul fournisseur social déclaré : le chemin suffit à identifier la
// demande, sans lire le corps de la requête. Le retour du fournisseur est gardé au
// même titre que le départ, sinon un flux ouvert avant la coupure aboutit encore.
// `/oauth-proxy-callback` est ce retour quand il transite par l'instance pivot.
const SOCIAL_PATHS = ['/sign-in/social', '/link-social', '/oauth-proxy-callback']
const CALLBACK_PREFIX = '/callback/'

function isSocialRequest(request: Request): boolean {
  const { pathname } = new URL(request.url)
  if (!pathname.startsWith(BASE_PATH)) return false

  const authPath = pathname.slice(BASE_PATH.length).replace(/\/$/, '')

  return SOCIAL_PATHS.includes(authPath) || authPath.startsWith(CALLBACK_PREFIX)
}

async function guardSocial(request: Request): Promise<NextResponse | null> {
  if (!isSocialRequest(request)) return null
  // Seul le drapeau est testé, pas `isGoogleConfigured` : sans identifiants, Better Auth
  // échoue déjà de lui-même à l'étape suivante.
  if (await isGoogleSignInEnabled()) return null

  return NextResponse.json({ error: 'signInDisabled' }, { status: 403 })
}

export async function GET(request: Request) {
  const refusal = await guardSocial(request)
  if (refusal) return refusal

  return handler.GET(request)
}

export async function POST(request: Request) {
  const refusal = await guardSocial(request)
  if (refusal) return refusal

  return handler.POST(request)
}
