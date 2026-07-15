import { Breadcrumbs, Card, StatusDot } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { calculateRemainingBalance } from '@/domain/enrollment'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { formatAmount } from '@/lib/decimal'
import { requireFamilyScope } from '../../_lib/auth-helper'
import { PaymentsTable } from './_components/payments-table'
import { RecordPaymentDialog } from './_components/record-payment-dialog'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ action?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.payments.title'),
  }
}

export default async function PaymentsPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { action } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.payments')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const scope = await requireFamilyScope()

  const isAdmin = scope.isAdmin

  const families = scope.isAdmin
    ? await db.family.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []

  const selectedPeriodId = await getSelectedPeriodId()

  const whereClause = {
    isActive: true,
    ...(scope.isAdmin ? {} : { familyId: scope.familyId }),
    ...(selectedPeriodId
      ? {
          enrollment: {
            classAssignments: { some: { classPeriod: { periodId: selectedPeriodId } } },
          },
        }
      : {}),
  }

  let remainingBalance = 0
  if (!scope.isAdmin) {
    const [dueAggregate, paidAggregate] = await Promise.all([
      db.enrollment.aggregate({
        where: {
          isActive: true,
          status: { in: ['PENDING', 'ACTIVE'] },
          student: { person: { families: { some: { familyId: scope.familyId } } } },
        },
        _sum: { totalAmount: true },
      }),
      db.payment.aggregate({
        where: { isActive: true, familyId: scope.familyId },
        _sum: { amount: true },
      }),
    ])
    const totalDue = Number(dueAggregate._sum.totalAmount ?? 0)
    const totalPaid = Number(paidAggregate._sum.amount ?? 0)
    remainingBalance = calculateRemainingBalance(totalDue, totalPaid)
  }

  const payments = await db.payment.findMany({
    where: whereClause,
    include: {
      family: true,
      enrollment: {
        include: {
          student: {
            include: {
              person: true,
            },
          },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
  })

  const paymentRows = payments.map((payment) => ({
    id: payment.id,
    enrollmentId: payment.enrollmentId,
    familyName: payment.family.name,
    studentName: `${payment.enrollment.student.person.name} ${payment.enrollment.student.person.lastname}`,
    amount: Number(payment.amount),
    method: payment.method,
    reference: payment.reference,
    paidAt: payment.paidAt,
    cashedAt: payment.cashedAt,
  }))

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('payments') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {families.length > 0 && (
          <RecordPaymentDialog families={families} defaultOpen={action === 'create'} />
        )}
      </div>
      {!scope.isAdmin && (
        <Card className="rounded-xl border border-gray-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('summary.remaining')}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                €{formatAmount(remainingBalance)}
              </p>
              <div className="mt-2">
                <StatusDot
                  color={remainingBalance > 0 ? 'amber' : 'green'}
                  label={remainingBalance > 0 ? t('summary.outstanding') : t('summary.upToDate')}
                />
              </div>
            </div>
            <Link
              href={`/dashboard/families/${scope.familyId}`}
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              {t('summary.viewFamily')}
            </Link>
          </div>
        </Card>
      )}
      <Card className="rounded-xl border border-gray-200">
        <PaymentsTable payments={paymentRows} locale={locale} isAdmin={isAdmin} />
      </Card>
    </div>
  )
}
