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
      <div className="h-1 bg-[var(--color-primary)]" />
      <NavbarServer />
      <main className="flex-1 bg-gray-50">{children}</main>
    </div>
  )
}
