import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { DashboardHeader, Sidebar } from '@/features/dashboard'
import { localizedHref } from '@/i18n/localized-href'
import { auth } from '@/lib/auth'
import { getBrandingConfig } from '@/lib/branding'
import { db } from '@/lib/db'
import type { Role } from '@/types/enums'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

async function DashboardSidebarServer({ locale }: { locale: string }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) redirect(localizedHref(locale, '/login'))

  const [branding, dbUser] = await Promise.all([
    getBrandingConfig(),
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        families: {
          select: { familyId: true },
          take: 1,
        },
      },
    }),
  ])

  const role: Role = dbUser?.role || 'PARENT'
  const userName = session.user.name || session.user.email || undefined

  return (
    <Sidebar
      role={role}
      familyId={dbUser?.families[0]?.familyId}
      logoUrl={branding.logoUrl}
      schoolName={branding.schoolName}
      userName={userName}
    />
  )
}

export default async function DashboardLayout({ children, params }: Props) {
  await connection()
  const { locale } = await params

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Suspense fallback={<div className="hidden w-64 bg-white md:block" />}>
        <DashboardSidebarServer locale={locale} />
      </Suspense>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10">
          <Suspense fallback={<header className="h-16" />}>
            <DashboardHeader />
          </Suspense>
        </div>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Suspense fallback={<div className="p-6">Loading...</div>}>{children}</Suspense>
        </main>
      </div>
    </div>
  )
}
