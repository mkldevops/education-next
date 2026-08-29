import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ForgotPasswordForm } from '@/features/auth'
import { redirect } from '@/i18n/routing'
import { auth } from '@/lib/auth'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.forgotPassword' })

  return {
    title: t('title'),
    description: t('subtitle'),
  }
}

export default async function ForgotPasswordPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth.api.getSession({ headers: await headers() })
  if (session) {
    redirect({ href: '/dashboard', locale })
  }

  const t = await getTranslations('auth.forgotPassword')

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded bg-white shadow-lg">
          <div className="bg-[var(--color-primary)] px-8 py-6 text-center">
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
            <p className="mt-1 text-sm text-white/80">{t('subtitle')}</p>
          </div>
          <div className="px-8 py-8">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </div>
  )
}
