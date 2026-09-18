import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { requireSchoolScope } from '../../_lib/auth-helper'
import { StudentsDataTable } from './_components/students-data-table'
import { getStudentDialogData } from './[id]/_lib/student-detail'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.students.title'),
  }
}

export default async function StudentsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.students')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const scope = await requireSchoolScope()

  const isAdmin = scope.isAdmin
  const whereFamilies = scope.isAdmin ? undefined : { some: { familyId: scope.familyId } }
  const selectedPeriod = await getSelectedPeriod(scope.schoolId)

  const paymentsEnabled = await isPaymentsEnabled(scope.schoolId)

  const students = await db.student.findMany({
    where: {
      schoolId: scope.schoolId,
      isActive: true,
      ...(whereFamilies && { person: { families: whereFamilies } }),
    },
    include: {
      person: {
        include: {
          families: {
            include: {
              family: true,
            },
          },
        },
      },
      enrollments: {
        where: {
          status: { in: ['PENDING', 'ACTIVE'] },
          ...(selectedPeriod
            ? { classAssignments: { some: { classPeriod: { periodId: selectedPeriod.id } } } }
            : {}),
        },
        select: {
          classAssignments: {
            where: { endAt: null },
            select: {
              classPeriod: { select: { level: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { person: { lastname: 'asc' } },
  })

  // Le dialogue d'inscription est monté une seule fois pour toute la table : plans et classes
  // sont donc chargés ici, pas par ligne.
  const { plans, classes } = await getStudentDialogData(
    scope.schoolId,
    isAdmin,
    selectedPeriod?.id ?? null
  )

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('students') },
        ]}
      />
      <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
      <StudentsDataTable
        data={students}
        locale={locale}
        isAdmin={isAdmin}
        plans={plans.map((plan) => ({ id: plan.id, name: plan.name }))}
        classes={classes.map((classPeriod) => ({
          id: classPeriod.id,
          name: `${classPeriod.name} (${classPeriod.level.name} — ${classPeriod.period.name})`,
        }))}
        paymentsEnabled={paymentsEnabled}
        today={new Date()}
      />
    </div>
  )
}
