import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { RegisterForm } from '@/features/auth'
import { Link, redirect } from '@/i18n/routing'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.register' })

  return {
    title: t('title'),
    description: t('subtitle'),
  }
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return redirect({ href: '/login', locale })

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { roles: true },
  })
  const rolesRaw = dbUser?.roles
  const roles: string[] = Array.isArray(rolesRaw)
    ? rolesRaw
    : typeof rolesRaw === 'string'
      ? JSON.parse(rolesRaw)
      : []
  if (!roles.includes('admin')) redirect({ href: '/dashboard', locale })

  const t = await getTranslations('auth.register')

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('title')}</h1>
          <p className="mt-2 text-sm text-gray-600">{t('subtitle')}</p>
        </div>

        <RegisterForm />

        <p className="text-center text-sm text-gray-600">
          {t('hasAccount')}{' '}
          <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  )
}
