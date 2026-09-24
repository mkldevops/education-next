import { PageHeader } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { resolveDebtorFamily } from '@/domain/family-debtor'
import { redirect } from '@/i18n/routing'
import { db } from '@/lib/db'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import {
  calculateFamilyBalance,
  isPayableEnrollment,
  PAYABLE_ENROLLMENT_STATUSES,
} from '@/use-cases/payments/family-balance'
import { requireSchoolScope } from '../../_lib/auth-helper'
import { CreateFamilyDialog } from './_components/create-family-dialog'
import { FamiliesDataTable, type FamilyRow } from './_components/families-data-table'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ action?: string }>
}

/** Paiements listés dans le popover d'une ligne ; au-delà, un compteur prend le relais. */
const PAYMENTS_PREVIEWED = 5

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.families.title'),
  }
}

export default async function FamiliesPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { action } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.families')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const scope = await requireSchoolScope()
  const paymentsEnabled = await isPaymentsEnabled(scope.schoolId)

  if (!scope.isAdmin) {
    redirect({ href: `/dashboard/families/${scope.familyId}`, locale })
  }

  const isAdmin = scope.isAdmin

  const families = await db.family.findMany({
    where: { schoolId: scope.schoolId, isActive: true },
    select: {
      id: true,
      name: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      persons: {
        select: {
          person: {
            select: {
              families: { select: { familyId: true, relationType: true } },
              student: {
                select: {
                  enrollments: {
                    // Payments on a cancelled or completed enrollment stay in the paid total.
                    where: {
                      OR: [
                        { status: { in: [...PAYABLE_ENROLLMENT_STATUSES] } },
                        { payments: { some: { isActive: true } } },
                      ],
                    },
                    select: {
                      id: true,
                      status: true,
                      totalAmount: true,
                      discount: true,
                      payments: {
                        where: { isActive: true },
                        select: { amount: true, method: true, paidAt: true, cashedAt: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const familyRows: FamilyRow[] = families.map((family) => {
    const enrollments = family.persons.flatMap((fp) => {
      const studentEnrollments = fp.person.student?.enrollments ?? []
      if (studentEnrollments.length === 0) return []
      const debtorFamilyId = resolveDebtorFamily(fp.person.families)?.familyId
      return debtorFamilyId === family.id ? studentEnrollments : []
    })
    const balance = calculateFamilyBalance(enrollments)
    const payments = enrollments
      .flatMap((enrollment) => enrollment.payments)
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())

    return {
      id: family.id,
      name: family.name,
      emergencyContactName: family.emergencyContactName,
      emergencyContactPhone: family.emergencyContactPhone,
      studentCount: family.persons.filter((fp) => fp.person.student).length,
      enrollmentCount: enrollments.filter((enrollment) => isPayableEnrollment(enrollment.status))
        .length,
      due: balance.totalAmount,
      paid: balance.totalPaid,
      remaining: balance.remainingBalance,
      payments: payments.slice(0, PAYMENTS_PREVIEWED).map((payment) => ({
        amount: Number(payment.amount),
        method: payment.method,
        paidAt: payment.paidAt,
        cashedAt: payment.cashedAt,
      })),
      paymentCount: payments.length,
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('families') },
        ]}
        title={t('title')}
        description={t('description')}
        actions={isAdmin && <CreateFamilyDialog defaultOpen={action === 'create'} />}
      />
      <FamiliesDataTable data={familyRows} paymentsEnabled={paymentsEnabled} />
    </div>
  )
}
