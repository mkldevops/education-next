import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { auth } from '@/lib/auth'

const intlMiddleware = createMiddleware(routing)
const defaultLocaleMiddleware = createMiddleware({
  ...routing,
  localeDetection: false,
  localePrefix: 'never',
})

const protectedPaths = ['/dashboard', '/settings', '/profile']

function getPathLocale(pathname: string) {
  return routing.locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const pathLocale = getPathLocale(pathname)
  const pathWithoutLocale = pathLocale
    ? pathname.replace(new RegExp(`^/${pathLocale}`), '')
    : pathname
  const isProtected = protectedPaths.some((p) => pathWithoutLocale.startsWith(p))

  if (isProtected) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      const loginPath = pathLocale ? `/${pathLocale}/login` : '/login'
      return NextResponse.redirect(new URL(loginPath, request.url))
    }
  }

  if (!pathLocale) {
    return defaultLocaleMiddleware(request)
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/', '/((?!api|_next|_vercel|icon|.*\\..*).*)'],
}
