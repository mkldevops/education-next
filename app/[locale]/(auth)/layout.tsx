import { setRequestLocale } from 'next-intl/server'
import { NavbarServer } from '@/features/navbar'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AuthLayout({ children, params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="flex min-h-screen flex-col">
      <NavbarServer />
      <main className="flex-1">{children}</main>
    </div>
  )
}
