import { Suspense } from 'react'
import { DashboardHeader, Sidebar } from '@/features/dashboard'

type Props = {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="relative flex flex-1 flex-col">
        <div className="absolute inset-x-0 top-0 z-10">
          <DashboardHeader />
        </div>
        <main className="flex-1 p-6 pt-16">
          <Suspense>{children}</Suspense>
        </main>
      </div>
    </div>
  )
}
