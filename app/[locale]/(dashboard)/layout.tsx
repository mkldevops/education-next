import { headers } from 'next/headers'
import { Suspense } from 'react'
import { DashboardHeader, Sidebar } from '@/features/dashboard'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Role } from '@/types/enums'

type Props = {
  children: React.ReactNode
}

export default async function DashboardLayout({ children }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  let role: Role = 'PARENT'

  if (session?.user.id) {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (dbUser) {
      role = dbUser.role
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={role} />
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
