import { Breadcrumbs, EmptyState } from '@peaklab/ui'
import { CalendarDays } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { attendanceUtcDate } from '@/domain/attendance-date'
import { currentWeekDates } from '@/domain/current-week-dates'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { classScheduleGateway } from '@/gateways/class-schedule-gateway'
import { configGateway } from '@/gateways/config-gateway'
import { schoolGateway } from '@/gateways/school-gateway'
import { localizedHref } from '@/i18n/localized-href'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import {
  CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY,
  ClassScheduleVisibility,
} from '@/lib/class-schedule-config'
import { db } from '@/lib/db'
import { isActiveSchoolAdmin } from '@/lib/school-context'
import { isClassScheduleEnabled } from '@/use-cases/class-schedules/is-class-schedule-enabled'
import { requireSchoolSession, requireTeacher } from '../../_lib/auth-helper'
import { schoolScopedPageMetadata } from '../../_lib/page-metadata'
import { ScheduleGrid } from './_components/schedule-grid'
import { ScheduleSlotDialog } from './_components/schedule-slot-dialog'
import { SharePublicScheduleLink } from './_components/share-public-schedule-link'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return schoolScopedPageMetadata(locale, 'dashboard.pages.planning.title')
}

type PlanningScope =
  | { kind: 'admin'; schoolId: string; isAdmin: true }
  | {
      kind: 'parent'
      schoolId: string
      isAdmin: false
      familyId: string
      teacherId: string | null
    }
  | { kind: 'teacher'; schoolId: string; isAdmin: false; teacherId: string }

/**
 * Le personnel voit toute l'école, un parent les créneaux de ses enfants, auxquels s'ajoutent
 * ceux de ses classes s'il enseigne aussi. Un compte sans l'un ni l'autre n'entre qu'avec une
 * fiche enseignant active, et ne voit alors que les classes qui lui sont affectées ; sinon
 * `requireTeacher()` répond `notFound()`.
 */
async function resolvePlanningScope(): Promise<PlanningScope> {
  const context = await requireSchoolSession()
  if (isActiveSchoolAdmin(context)) {
    return { kind: 'admin', schoolId: context.schoolId, isAdmin: true }
  }
  if (context.familyId) {
    const teacher = await db.teacher.findFirst({
      where: { schoolId: context.schoolId, userId: context.userId, isActive: true },
      select: { id: true },
    })
    return {
      kind: 'parent',
      schoolId: context.schoolId,
      isAdmin: false,
      familyId: context.familyId,
      teacherId: teacher?.id ?? null,
    }
  }
  const { schoolId, teacherId } = await requireTeacher()
  return { kind: 'teacher', schoolId, isAdmin: false, teacherId }
}

async function listMemberSlots(scope: Exclude<PlanningScope, { kind: 'admin' }>, periodId: string) {
  if (scope.kind === 'teacher') {
    return classScheduleGateway.listByTeacherAndPeriod(scope.schoolId, scope.teacherId, periodId)
  }
  const [familySlots, teacherSlots] = await Promise.all([
    classScheduleGateway.listByFamilyAndPeriod(scope.schoolId, scope.familyId, periodId),
    scope.teacherId
      ? classScheduleGateway.listByTeacherAndPeriod(scope.schoolId, scope.teacherId, periodId)
      : Promise.resolve([]),
  ])
  const familySlotIds = new Set(familySlots.map((slot) => slot.id))
  return [...familySlots, ...teacherSlots.filter((slot) => !familySlotIds.has(slot.id))].sort(
    (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)
  )
}

export default async function PlanningPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  const scope = await resolvePlanningScope()
  if (!(await isClassScheduleEnabled(scope.schoolId))) notFound()

  const [t, tBreadcrumbs, selectedPeriod, school, visibility, attendanceConfig] = await Promise.all(
    [
      getTranslations('dashboard.pages.planning'),
      getTranslations('dashboard.breadcrumbs'),
      getSelectedPeriod(scope.schoolId),
      schoolGateway.findActiveById(scope.schoolId),
      configGateway.get(scope.schoolId, CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY),
      configGateway.get(scope.schoolId, ATTENDANCE_ENABLED_CONFIG_KEY),
    ]
  )
  const publicScheduleHref =
    school && visibility?.value === ClassScheduleVisibility.Public
      ? localizedHref(locale, `/ecole/${school.slug}/planning`)
      : null

  if (!selectedPeriod) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
            { label: tBreadcrumbs('planning') },
          ]}
        />
        <div>
          <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
          <p className="mt-1 text-sm text-graphite-600">{t('description')}</p>
        </div>
        <EmptyState icon={CalendarDays} title={t('emptyNoPeriod')} />
      </div>
    )
  }

  const [slots, classes] = await Promise.all([
    scope.isAdmin
      ? db.classScheduleSlot.findMany({
          where: {
            schoolId: scope.schoolId,
            classPeriod: { periodId: selectedPeriod.id, isActive: true },
          },
          include: {
            classPeriod: { select: { id: true, name: true } },
            teachers: {
              include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
          orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
        })
      : listMemberSlots(scope, selectedPeriod.id),
    scope.isAdmin
      ? db.classPeriod.findMany({
          where: { schoolId: scope.schoolId, periodId: selectedPeriod.id, isActive: true },
          select: {
            id: true,
            name: true,
            teachers: {
              where: { teacher: { isActive: true } },
              select: { teacher: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ])

  const classOptions = classes.map((classPeriod) => ({
    id: classPeriod.id,
    name: classPeriod.name,
  }))
  const teachersByClass = Object.fromEntries(
    classes.map((classPeriod) => [
      classPeriod.id,
      classPeriod.teachers.map(({ teacher }) => ({
        id: teacher.id,
        name: `${teacher.lastName} ${teacher.firstName}`.trim(),
      })),
    ])
  )
  const weekdayLabels = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => [index + 1, t(`weekdays.${index + 1}`)])
  ) as Record<number, string>
  const attendance =
    scope.kind !== 'parent' && readsAsOptedIn(attendanceConfig?.value)
      ? {
          datesByWeekday: currentWeekDates(attendanceUtcDate(undefined)),
          label: t('slot.takeAttendance'),
        }
      : undefined

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('planning') },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
          <p className="mt-1 text-sm text-graphite-600">
            {t('description')} · {selectedPeriod.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {publicScheduleHref && <SharePublicScheduleLink href={publicScheduleHref} />}
          {scope.isAdmin && classOptions.length > 0 && (
            <ScheduleSlotDialog classes={classOptions} teachersByClass={teachersByClass} />
          )}
        </div>
      </div>
      {slots.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t('empty')} description={t(`${scope.kind}Hint`)} />
      ) : (
        <ScheduleGrid
          slots={slots}
          weekdayLabels={weekdayLabels}
          noTeachersLabel={t('slot.noTeachers')}
          studentsLabel={t('slot.students')}
          contentLabel={t('slot.content')}
          durationUnits={{ hours: t('duration.hours'), minutes: t('duration.minutes') }}
          classes={classOptions}
          teachersByClass={teachersByClass}
          isAdmin={scope.isAdmin}
          attendance={attendance}
        />
      )}
    </div>
  )
}
