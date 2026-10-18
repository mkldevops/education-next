import { PageHeader } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { db } from '@/lib/db'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { requireSchoolScope } from '../../_lib/auth-helper'
import {
  classOptionSelect,
  loadSuggestedLevels,
  toClassOption,
} from '../../_lib/class-options-loader'
import { CreateEnrollmentDialog } from './_components/create-enrollment-dialog'
import { EnrollmentsTable } from './_components/enrollments-table'

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

  const scope = await requireSchoolScope()

  const selectedPeriod = await getSelectedPeriod(scope.schoolId)
  const selectedPeriodId = selectedPeriod?.id ?? null

  const paymentsEnabled = await isPaymentsEnabled(scope.schoolId)

  const isAdmin = scope.isAdmin

  const whereStudent = isAdmin
    ? {}
    : {
        person: {
          families: {
            some: { familyId: scope.familyId },
          },
        },
      }

  const classRows = isAdmin
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

  const availablePlans =
    isAdmin && paymentsEnabled
      ? await db.plan.findMany({
          where: { schoolId: scope.schoolId, isActive: true, name: { not: UNPRICED_PLAN_NAME } },
          select: { id: true, name: true, amount: true },
          orderBy: { name: 'asc' },
        })
      : []
  // `amount` pré-remplit le montant dû du dialogue de création ; converti ici car un `Decimal`
  // ne traverse pas la frontière client.
  const planOptions = availablePlans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    amount: Number(plan.amount),
  }))

  const availableStudents = isAdmin
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

  const serializableEnrollments = enrollments.map((enrollment) => ({
    ...enrollment,
    totalAmount: Number(enrollment.totalAmount),
    discount: Number(enrollment.discount),
    plan: { ...enrollment.plan, amount: Number(enrollment.plan.amount) },
    payments: enrollment.payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount),
    })),
  }))

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
          isAdmin && (
            <CreateEnrollmentDialog
              students={studentOptions}
              plans={planOptions}
              classes={classOptions}
              paymentsEnabled={paymentsEnabled}
              defaultOpen={action === 'create'}
            />
          )
        }
      />
      <EnrollmentsTable
        enrollments={serializableEnrollments}
        isAdmin={isAdmin}
        availableClasses={availableClasses}
        availablePlans={planOptions}
        locale={locale}
        periodName={selectedPeriod?.name ?? null}
        paymentsEnabled={paymentsEnabled}
      />
    </div>
  )
}
