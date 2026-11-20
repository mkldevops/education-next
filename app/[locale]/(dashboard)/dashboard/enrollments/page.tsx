import { PageHeader } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { db } from '@/lib/db'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { requireSchoolRecordsScope } from '../../_lib/auth-helper'
import {
  classOptionSelect,
  loadSuggestedLevels,
  toClassOption,
} from '../../_lib/class-options-loader'
import { toPlanOption } from '../../_lib/plan-options'
import { EnrollmentCreateActions } from './_components/enrollment-create-actions'
import { EnrollmentsTable } from './_components/enrollments-table'
import { serializeEnrollment } from './_lib/serialize-enrollment'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ action?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.enrollments.title'),
  }
}

export default async function EnrollmentsPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { action } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.enrollments')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const scope = await requireSchoolRecordsScope()

  const selectedPeriod = await getSelectedPeriod(scope.schoolId)
  const { currency } = await getSchoolRegionalSettings(scope.schoolId)
  const selectedPeriodId = selectedPeriod?.id ?? null

  // Un enseignant à accès élargi gère les inscriptions sans aucune donnée financière.
  const paymentsEnabled = scope.isAdmin && (await isPaymentsEnabled(scope.schoolId))

  const isStaff = scope.isStaff

  const whereStudent = scope.isStaff
    ? {}
    : {
        person: {
          families: {
            some: { familyId: scope.familyId },
          },
        },
      }

  const classRows = isStaff
    ? await db.classPeriod.findMany({
        where: {
          schoolId: scope.schoolId,
          isActive: true,
          ...(selectedPeriodId ? { periodId: selectedPeriodId } : {}),
        },
        select: classOptionSelect,
        orderBy: { name: 'asc' },
      })
    : []
  const availableClasses = classRows.map((row) => ({ id: row.id, name: row.name }))
  const classOptions = classRows.map((row) => toClassOption(row))

  const availablePlans = paymentsEnabled
    ? await db.plan.findMany({
        where: { schoolId: scope.schoolId, isActive: true, name: { not: UNPRICED_PLAN_NAME } },
        select: { id: true, name: true, amount: true, paymentSchedule: true },
        orderBy: { name: 'asc' },
      })
    : []
  // `amount` pré-remplit le montant dû du dialogue de création, l'échéancier montre ses
  // échéances ; convertis ici car un `Decimal` ne traverse pas la frontière client.
  const planOptions = availablePlans.map(toPlanOption)

  const availableStudents = isStaff
    ? await db.student.findMany({
        where: { schoolId: scope.schoolId, isActive: true },
        select: {
          id: true,
          person: {
            select: {
              name: true,
              lastname: true,
              families: { select: { family: { select: { name: true } } } },
            },
          },
        },
        orderBy: [{ person: { lastname: 'asc' } }, { person: { name: 'asc' } }],
      })
    : []
  const availableStudentIds = availableStudents.map((student) => student.id)
  // Élèves déjà inscrits sur la période et niveau suggéré : le dialogue signale les premiers
  // et propose d'abord les classes du second (#464).
  const [enrolledInPeriod, suggestedLevels] = await Promise.all([
    selectedPeriodId
      ? enrollmentGateway.findStudentIdsEnrolledInPeriod(
          scope.schoolId,
          availableStudentIds,
          selectedPeriodId
        )
      : new Set<string>(),
    loadSuggestedLevels(scope.schoolId, availableStudentIds, selectedPeriodId),
  ])
  const studentOptions = availableStudents.map((student) => ({
    id: student.id,
    name: `${student.person.name} ${student.person.lastname}`,
    familyName: student.person.families.map(({ family }) => family.name).join(', '),
    suggestedLevelId: suggestedLevels.get(student.id) ?? null,
    enrolledInPeriod: enrolledInPeriod.has(student.id),
  }))

  const enrollments = await db.enrollment.findMany({
    where: {
      schoolId: scope.schoolId,
      isActive: true,
      student: whereStudent,
      ...(selectedPeriodId
        ? { classAssignments: { some: { classPeriod: { periodId: selectedPeriodId } } } }
        : {}),
    },
    include: {
      student: {
        include: {
          person: {
            include: {
              families: {
                include: { family: true },
              },
            },
          },
        },
      },
      plan: true,
      classAssignments: {
        include: {
          classPeriod: {
            include: {
              level: true,
              period: true,
            },
          },
        },
      },
      payments: {
        where: { isActive: true },
        orderBy: { paidAt: 'desc' },
      },
    },
    orderBy: { registeredAt: 'desc' },
  })

  // Rien de financier ne part vers le client d'un enseignant, même masqué par l'interface.
  const serializableEnrollments = enrollments.map((enrollment) =>
    serializeEnrollment(enrollment, { isAdmin: scope.isAdmin })
  )

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
          { label: tBreadcrumbs('enrollments') },
        ]}
        title={t('title')}
        description={t('description')}
        actions={
          isStaff && (
            <EnrollmentCreateActions
              families={families}
              students={studentOptions}
              plans={planOptions}
              classes={classOptions}
              paymentsEnabled={paymentsEnabled}
              currency={currency}
              defaultOpen={action === 'create'}
            />
          )
        }
      />
      <EnrollmentsTable
        currency={currency}
        enrollments={serializableEnrollments}
        isAdmin={isStaff}
        availableClasses={availableClasses}
        availablePlans={planOptions}
        locale={locale}
        periodName={selectedPeriod?.name ?? null}
        paymentsEnabled={paymentsEnabled}
      />
    </div>
  )
}
