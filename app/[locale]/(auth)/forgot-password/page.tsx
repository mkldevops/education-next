import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ForgotPasswordForm } from '@/features/auth'
import { redirect } from '@/i18n/routing'
import { getSchoolContext } from '@/lib/school-context'
import { AuthCard } from '../_components/auth-card'

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

  const context = await getSchoolContext()
  if (context) {
    redirect({ href: '/dashboard', locale })
  }

  const t = await getTranslations('auth.forgotPassword')

  return (
    <AuthCard title={t('title')} subtitle={t('subtitle')}>
      <ForgotPasswordForm />
    </AuthCard>
  )
}
