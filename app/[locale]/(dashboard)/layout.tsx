import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import {
  DashboardHeader,
  EventAnnouncementBanner,
  ImpersonationBanner,
  Sidebar,
} from '@/features/dashboard'
import { localizedHref } from '@/i18n/localized-href'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { auth } from '@/lib/auth'
import { getBrandingConfig } from '@/lib/branding'
import { CLASS_SCHEDULE_ENABLED_CONFIG_KEY } from '@/lib/class-schedule-config'
import { db } from '@/lib/db'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'
import {
  ACTIVE_SCHOOL_COOKIE,
  getAuthorizedSchools,
  getSchoolContext,
  hasActiveSchoolStaffAccess,
} from '@/lib/school-context'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { isAiAssistantEnabled } from '@/use-cases/platform-settings/is-ai-assistant-enabled'
import { isSchoolSwitchEnabled } from '@/use-cases/platform-settings/is-school-switch-enabled'
import { AssistantDock } from './_components/ai-chat/assistant-dock'
import { AnnouncementGate } from './_components/announcement-gate'
import { AnnouncementsButton } from './_components/announcements-button'
import { RememberActiveSchool } from './_components/remember-active-school'
import { SignInUpgradeGate } from './_components/sign-in-upgrade-gate'

function readConfigFlag(schoolId: string, name: string) {
  return db.config
    .findFirst({ where: { schoolId, name, isActive: true }, select: { value: true } })
    .then((config) => config?.value === 'true')
}

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
    eventsEnabled,
    classScheduleEnabled,
    paymentsEnabled,
    cookieStore,
    teacher,
    attendanceEnabled,
    aiAssistantEnabled,
    hasStaffAccess,
  ] = await Promise.all([
    getBrandingConfig(context.schoolId),
    auth.api.getSession({ headers: await headers() }),
    getAuthorizedSchools(),
    isSchoolSwitchEnabled(),
    readConfigFlag(context.schoolId, EVENTS_CONFIG_KEY),
    readConfigFlag(context.schoolId, CLASS_SCHEDULE_ENABLED_CONFIG_KEY),
    isPaymentsEnabled(context.schoolId),
    cookies(),
    db.teacher.findFirst({
      where: { schoolId: context.schoolId, userId: context.userId, isActive: true },
      select: { id: true },
    }),
    readConfigFlag(context.schoolId, ATTENDANCE_ENABLED_CONFIG_KEY),
    isAiAssistantEnabled(),
    hasActiveSchoolStaffAccess(context),
  ])
  // La page de connexion n'a pas de session : elle s'habille de l'école désignée par ce cookie.
  const rememberSchool = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value !== context.schoolId

  const userName = session?.user.name || session?.user.email || undefined

  return (
    <>
      {rememberSchool && <RememberActiveSchool />}
      <Sidebar
        role={context.role}
        isSuperAdmin={context.isSuperAdmin}
        paymentsEnabled={paymentsEnabled}
        familyId={context.role === 'PARENT' ? (context.familyId ?? undefined) : undefined}
        hasTeacherCapability={teacher !== null}
        hasStaffAccess={context.role === 'TEACHER' && hasStaffAccess}
        logoUrl={branding.logoUrl}
        schoolName={branding.schoolName}
        userName={userName}
        schools={schools}
        activeSchoolId={context.schoolId}
        canSwitchSchool={switchAllowed}
        classScheduleEnabled={classScheduleEnabled}
        eventsEnabled={eventsEnabled}
        attendanceEnabled={attendanceEnabled}
        aiAssistantEnabled={aiAssistantEnabled}
      />
    </>
  )
}

export default async function DashboardLayout({ children, params }: Props) {
  await connection()
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Suspense
        fallback={
          <div className="hidden w-60 shrink-0 border-r border-border bg-background md:block" />
        }
      >
        <DashboardSidebarServer locale={locale} />
      </Suspense>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="z-10 shrink-0">
          <Suspense fallback={null}>
            <ImpersonationBanner />
          </Suspense>
          <Suspense fallback={null}>
            <SignInUpgradeGate />
          </Suspense>
          <Suspense fallback={null}>
            <AnnouncementGate locale={locale} />
          </Suspense>
          <Suspense fallback={null}>
            <EventAnnouncementBanner />
          </Suspense>
          <Suspense fallback={<header className="h-14 border-b border-border" />}>
            <DashboardHeader
              news={
                <Suspense fallback={null}>
                  <AnnouncementsButton locale={locale} />
                </Suspense>
              }
            />
          </Suspense>
        </div>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Suspense
              fallback={
                <div role="status" className="p-6 text-muted-foreground">
                  {t('loading')}
                </div>
              }
            >
              {children}
            </Suspense>
          </div>
        </main>
        <Suspense fallback={null}>
          <AssistantDock />
        </Suspense>
      </div>
    </div>
  )
}
