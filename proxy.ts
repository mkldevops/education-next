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
      const loginUrl = new URL(loginPath, request.url)
      // Sans préfixe de langue : le routeur localisé du formulaire le rajoute. La page de login
      // repasse ce chemin par `safeRedirectPath` avant de s'en servir.
      loginUrl.searchParams.set('redirectTo', `${pathWithoutLocale}${request.nextUrl.search}`)
      return NextResponse.redirect(loginUrl)
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
