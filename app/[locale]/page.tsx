import { headers } from 'next/headers'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { auth } from '@/lib/auth'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth.api.getSession({ headers: await headers() })

  redirect({ href: session ? '/dashboard' : '/login', locale })
}
