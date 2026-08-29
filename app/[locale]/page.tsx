import { setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { getSchoolContext } from '@/lib/school-context'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const context = await getSchoolContext()

  redirect({ href: context ? '/dashboard' : '/login', locale })
}
