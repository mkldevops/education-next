import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import {
  DashboardHeader,
  EventAnnouncementBanner,
  ImpersonationBanner,
  Sidebar,
} from '@/features/dashboard'
import { localizedHref } from '@/i18n/localized-href'
import { auth } from '@/lib/auth'
import { getBrandingConfig } from '@/lib/branding'
import { CLASS_SCHEDULE_ENABLED_CONFIG_KEY } from '@/lib/class-schedule-config'
import { db } from '@/lib/db'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'
import { ACTIVE_SCHOOL_COOKIE, getAuthorizedSchools, getSchoolContext } from '@/lib/school-context'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { isSchoolSwitchEnabled } from '@/use-cases/platform-settings/is-school-switch-enabled'
import { RememberActiveSchool } from './_components/remember-active-school'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

async function DashboardSidebarServer({ locale }: { locale: string }) {
  const context = await getSchoolContext()
  if (!context) redirect(localizedHref(locale, '/login'))

  // La tête de la barre latérale suit le drapeau seul, super-admin compris : le réglage
  // vit sur `/dashboard/config`, l'éteindre doit se voir immédiatement chez celui qui
  // l'écrit. L'issue de secours des liens profonds reste ouverte par `canSwitchSchool()`.
  const [
    branding,
    session,
    schools,
    switchAllowed,
    eventsConfig,
    classScheduleConfig,
    paymentsEnabled,
    cookieStore,
    teacher,
  ] = await Promise.all([
    getBrandingConfig(context.schoolId),
    auth.api.getSession({ headers: await headers() }),
    getAuthorizedSchools(),
    isSchoolSwitchEnabled(),
    db.config.findFirst({
      where: { schoolId: context.schoolId, name: EVENTS_CONFIG_KEY, isActive: true },
      select: { value: true },
    }),
    db.config.findFirst({
      where: {
        schoolId: context.schoolId,
        name: CLASS_SCHEDULE_ENABLED_CONFIG_KEY,
        isActive: true,
      },
      select: { value: true },
    }),
    isPaymentsEnabled(context.schoolId),
    cookies(),
    db.teacher.findFirst({
      where: { schoolId: context.schoolId, userId: context.userId, isActive: true },
      select: { id: true },
    }),
  ])
  // La page de connexion n'a pas de session : elle s'habille de l'école désignée par ce cookie.
  const rememberSchool = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value !== context.schoolId

  const userName = session?.user.name || session?.user.email || undefined
  const eventsEnabled = eventsConfig?.value === 'true'
  const classScheduleEnabled = classScheduleConfig?.value === 'true'

  return (
    <>
      {rememberSchool && <RememberActiveSchool />}
      <Sidebar
        role={context.role}
        isSuperAdmin={context.isSuperAdmin}
        paymentsEnabled={paymentsEnabled}
        familyId={context.role === 'PARENT' ? (context.familyId ?? undefined) : undefined}
        hasTeacherCapability={teacher !== null}
        logoUrl={branding.logoUrl}
        schoolName={branding.schoolName}
        userName={userName}
        schools={schools}
        activeSchoolId={context.schoolId}
        canSwitchSchool={switchAllowed}
        classScheduleEnabled={classScheduleEnabled}
        eventsEnabled={eventsEnabled}
      />
    </>
  )
}

export default async function DashboardLayout({ children, params }: Props) {
  await connection()
  const { locale } = await params

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Suspense fallback={<div className="hidden w-64 bg-white md:block" />}>
        <DashboardSidebarServer locale={locale} />
      </Suspense>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="z-10 shrink-0">
          <Suspense fallback={null}>
            <ImpersonationBanner />
          </Suspense>
          <Suspense fallback={null}>
            <EventAnnouncementBanner />
          </Suspense>
          <Suspense fallback={<header className="h-16" />}>
            <DashboardHeader />
          </Suspense>
        </div>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-6">
          <Suspense fallback={<div className="p-6">Loading...</div>}>{children}</Suspense>
        </main>
      </div>
    </div>
  )
}
