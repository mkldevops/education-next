import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { MAX_STUDENTS_PER_CLASS_CONFIG_KEY } from '@/lib/school-config-defaults'
import { requireSchoolStaff } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { ClassesDataTable, type ClassRow } from './_components/classes-data-table'
import { CreateClassDialog } from './_components/create-class-dialog'
import { ROSTER_STATUSES } from './_lib/roster'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.classes.title')
}

export default async function ClassesPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.classes')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  // Un enseignant à accès élargi consulte toutes les classes sans les créer ni les modifier.
  const { schoolId, isAdmin } = await requireSchoolStaff()

  const selectedPeriod = await getSelectedPeriod(schoolId)
  const selectedPeriodId = selectedPeriod?.id ?? null

  const [levels, periods, maxStudentsConfig, teachers] = await Promise.all([
    db.level.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.period.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true },
      orderBy: { startAt: 'desc' },
    }),
    db.config.findFirst({
      where: { schoolId, name: MAX_STUDENTS_PER_CLASS_CONFIG_KEY, isActive: true },
      select: { value: true },
    }),
    db.teacher.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
  ])

  const parsedDefaultCapacity = Number(maxStudentsConfig?.value)
  const defaultCapacity =
    Number.isInteger(parsedDefaultCapacity) && parsedDefaultCapacity > 0
      ? parsedDefaultCapacity
      : undefined

  const classes = await db.classPeriod.findMany({
    where: {
      schoolId,
      isActive: true,
      ...(selectedPeriodId ? { periodId: selectedPeriodId } : {}),
    },
    include: {
      level: true,
      period: true,
      classAssignments: {
        where: {
          endAt: null,
          enrollment: { status: { in: [...ROSTER_STATUSES] } },
        },
      },
      teachers: {
        where: { teacher: { isActive: true } },
        include: { teacher: true },
      },
    },
    orderBy: { name: 'asc' },
  })
  const teacherOptions = teachers.map((teacher) => ({
    id: teacher.id,
    name: `${teacher.lastName} ${teacher.firstName}`.trim(),
  }))

  const rows: ClassRow[] = classes.map((item) => ({
    id: item.id,
    name: item.name,
    levelId: item.levelId,
    levelName: item.level.name,
    periodName: item.period.name,
    teacherNames: item.teachers.map(({ teacher }) =>
      `${teacher.lastName} ${teacher.firstName}`.trim()
    ),
    teacherIds: item.teachers.map(({ teacherId }) => teacherId),
    enrolledCount: item.classAssignments.length,
    capacity: item.capacity,
    editableLevels: levels.filter(
      (level) =>
        level.id === item.levelId ||
        !classes.some(
          (candidate) =>
            candidate.id !== item.id &&
            candidate.periodId === item.periodId &&
            candidate.levelId === level.id
        )
    ),
  }))

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('classes') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        {isAdmin && levels.length > 0 && periods.length > 0 && (
          <CreateClassDialog
            levels={levels}
            periods={periods}
            teachers={teacherOptions}
            defaultCapacity={defaultCapacity}
          />
        )}
      </div>
      <ClassesDataTable
        classes={rows}
        levels={levels}
        teachers={teacherOptions}
        canManage={isAdmin}
        emptyMessage={
          selectedPeriod ? t('noClassesInPeriod', { period: selectedPeriod.name }) : t('noClasses')
        }
      />
    </div>
  )
}
