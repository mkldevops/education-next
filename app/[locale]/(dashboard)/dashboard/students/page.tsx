import { PageHeader } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { getOverdueStudents } from '@/use-cases/payments/overdue-students'
import { requireSchoolRecordsScope } from '../../_lib/auth-helper'
import { AddStudentButton } from './_components/add-student-button'
import { StudentsDataTable } from './_components/students-data-table'
import { getStudentDialogData } from './[id]/_lib/student-detail'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ filter?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.students.title'),
  }
}

export default async function StudentsPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { filter } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.students')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const scope = await requireSchoolRecordsScope()

  const isStaff = scope.isStaff
  const whereFamilies = scope.isStaff ? undefined : { some: { familyId: scope.familyId } }
  const selectedPeriod = await getSelectedPeriod(scope.schoolId)

  // Un enseignant à accès élargi voit l'école comme si les paiements étaient coupés : il
  // inscrit sans formule et l'administration tarife ensuite.
  const paymentsEnabled = scope.isAdmin && (await isPaymentsEnabled(scope.schoolId))
  const { currency } = await getSchoolRegionalSettings(scope.schoolId)
  // Même calcul que « Familles en retard » des paiements : la période sélectionnée, le retard
  // de la famille redevable reporté sur chacun de ses enfants.
  const overdueAmounts: Record<string, number> = paymentsEnabled
    ? Object.fromEntries(
        (await getOverdueStudents(scope.schoolId, { periodId: selectedPeriod?.id })).map((row) => [
          row.studentId,
          row.family.overdueAmount,
        ])
      )
    : {}

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
    isStaff,
    selectedPeriod?.id ?? null
  )
  const planOptions = (paymentsEnabled ? plans : []).map((plan) => ({
    id: plan.id,
    name: plan.name,
    amount: Number(plan.amount),
  }))

  // Le parent n'ajoute pas d'élève : seul le staff charge la liste des familles.
  const families = isStaff
    ? await db.family.findMany({
        where: { schoolId: scope.schoolId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('students') },
        ]}
        title={t('title')}
        description={t('description')}
        actions={
          isStaff && (
            <AddStudentButton
              families={families}
              plans={planOptions}
              classes={classes}
              paymentsEnabled={paymentsEnabled}
              currency={currency}
            />
          )
        }
      />
      <StudentsDataTable
        data={students}
        locale={locale}
        isStaff={isStaff}
        plans={planOptions}
        classes={classes}
        paymentsEnabled={paymentsEnabled}
        currency={currency}
        today={new Date()}
        overdueAmounts={paymentsEnabled ? overdueAmounts : null}
        initialOverdueOnly={paymentsEnabled && filter === 'overdue'}
      />
    </div>
  )
}
