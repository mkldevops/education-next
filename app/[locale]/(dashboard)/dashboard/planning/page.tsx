import { Breadcrumbs, EmptyState } from '@peaklab/ui'
import { CalendarDays } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { classScheduleGateway } from '@/gateways/class-schedule-gateway'
import { configGateway } from '@/gateways/config-gateway'
import { schoolGateway } from '@/gateways/school-gateway'
import { localizedHref } from '@/i18n/localized-href'
import {
  CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY,
  ClassScheduleVisibility,
} from '@/lib/class-schedule-config'
import { db } from '@/lib/db'
import { isClassScheduleEnabled } from '@/use-cases/class-schedules/is-class-schedule-enabled'
import { requireSchoolScope } from '../../_lib/auth-helper'
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

export default async function PlanningPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  const scope = await requireSchoolScope()
  if (!(await isClassScheduleEnabled(scope.schoolId))) notFound()

  const [t, tBreadcrumbs, selectedPeriod, school, visibility] = await Promise.all([
    getTranslations('dashboard.pages.planning'),
    getTranslations('dashboard.breadcrumbs'),
    getSelectedPeriod(scope.schoolId),
    schoolGateway.findActiveById(scope.schoolId),
    configGateway.get(scope.schoolId, CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY),
  ])
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
      : classScheduleGateway.listByFamilyAndPeriod(
          scope.schoolId,
          scope.familyId,
          selectedPeriod.id
        ),
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
        name: `${teacher.lastName} ${teacher.firstName}`,
      })),
    ])
  )
  const weekdayLabels = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => [index + 1, t(`weekdays.${index + 1}`)])
  ) as Record<number, string>

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
        <EmptyState
          icon={CalendarDays}
          title={t('empty')}
          description={scope.isAdmin ? t('adminHint') : t('parentHint')}
        />
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
        />
      )}
    </div>
  )
}
