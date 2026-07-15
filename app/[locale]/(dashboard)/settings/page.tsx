import { setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  redirect({ href: '/dashboard/settings', locale })
}
