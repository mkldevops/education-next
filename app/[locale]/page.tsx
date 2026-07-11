import { setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  redirect({ href: '/login', locale })
}
