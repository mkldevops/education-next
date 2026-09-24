import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ResetPasswordForm } from '@/features/auth'

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
  const { token } = await searchParams

  return <ResetPasswordForm token={token} />
}
