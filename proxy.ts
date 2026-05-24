import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { auth } from '@/lib/auth'

const intlMiddleware = createMiddleware(routing)

const protectedPaths = ['/dashboard', '/settings', '/profile']

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const pathWithoutLocale = pathname.replace(/^\/(fr|en)/, '')
  const isProtected = protectedPaths.some((p) => pathWithoutLocale.startsWith(p))

  if (isProtected) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      const locale = pathname.startsWith('/en') ? 'en' : 'fr'
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
    }
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/', '/((?!api|_next|_vercel|icon|.*\\..*).*)'],
}
