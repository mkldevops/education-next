import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { DashboardHeader, Sidebar } from '@/features/dashboard'
import { localizedHref } from '@/i18n/localized-href'
import { auth } from '@/lib/auth'
import { getBrandingConfig } from '@/lib/branding'
import { getAuthorizedSchools, getSchoolContext } from '@/lib/school-context'
import { canSwitchSchool } from './_lib/school-switch'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

async function DashboardSidebarServer({ locale }: { locale: string }) {
  const context = await getSchoolContext()
  if (!context) redirect(localizedHref(locale, '/login'))

  const [branding, session, schools, switchAllowed] = await Promise.all([
    getBrandingConfig(context.schoolId),
    auth.api.getSession({ headers: await headers() }),
    getAuthorizedSchools(),
    canSwitchSchool(),
  ])

  const userName = session?.user.name || session?.user.email || undefined

  return (
    <Sidebar
      role={context.role}
      isSuperAdmin={context.isSuperAdmin}
      familyId={context.role === 'PARENT' ? (context.familyId ?? undefined) : undefined}
      logoUrl={branding.logoUrl}
      schoolName={branding.schoolName}
      userName={userName}
      schools={schools}
      activeSchoolId={context.schoolId}
      canSwitchSchool={switchAllowed}
    />
  )
}

export default async function DashboardLayout({ children, params }: Props) {
  await connection()
  const { locale } = await params

  return (
    <div className="flex min-h-screen bg-alabaster-900">
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
