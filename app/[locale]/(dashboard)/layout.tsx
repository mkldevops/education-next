import { setRequestLocale } from 'next-intl/server'
import { DashboardHeader, Sidebar } from '@/features/dashboard'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="relative flex flex-1 flex-col">
        <div className="absolute inset-x-0 top-0 z-10">
          <DashboardHeader />
        </div>
        <main className="flex-1 p-6 pt-16">{children}</main>
      </div>
    </div>
  )
}
