import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { Footer } from '@/features/footer'
import { NavbarServer } from '@/features/navbar'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function PagesLayout({ children, params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="flex min-h-screen flex-col">
      <NavbarServer />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
