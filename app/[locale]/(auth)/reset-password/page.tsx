import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ResetPasswordForm } from '@/features/auth'
import { AuthCard } from '../_components/auth-card'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ token?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.resetPassword' })

  return {
    title: t('title'),
    description: t('subtitle'),
  }
}

export default async function ResetPasswordPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('auth.resetPassword')
  const { token } = await searchParams

  return (
    <AuthCard title={t('title')} subtitle={t('subtitle')}>
      <ResetPasswordForm token={token} />
    </AuthCard>
  )
}
