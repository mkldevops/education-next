import { toNextJsHandler } from 'better-auth/next-js'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isGoogleSignInEnabled } from '@/use-cases/platform-settings/is-google-sign-in-enabled'

const handler = toNextJsHandler(auth)

// Google est le seul fournisseur social déclaré : le chemin suffit à identifier la
// demande, sans lire le corps de la requête.
const SOCIAL_PATHS = ['/sign-in/social', '/link-social']

async function guardSocial(request: Request): Promise<NextResponse | null> {
  const { pathname } = new URL(request.url)
  if (!SOCIAL_PATHS.some((path) => pathname.endsWith(path))) return null
  if (await isGoogleSignInEnabled()) return null

  return NextResponse.json({ error: 'signInDisabled' }, { status: 403 })
}

export const GET = handler.GET

export async function POST(request: Request) {
  const refusal = await guardSocial(request)
  if (refusal) return refusal

  return handler.POST(request)
}
