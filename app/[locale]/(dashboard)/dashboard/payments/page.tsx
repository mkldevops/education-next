import { PageHeader } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { readChartView } from '@/domain/collection-chart'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { redirect } from '@/i18n/routing'
import { db } from '@/lib/db'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { getCollectionSeries } from '@/use-cases/payments/collection-series'
import { listSchoolPayments } from '@/use-cases/payments/list-school-payments'
import { getPaymentStats } from '@/use-cases/payments/payment-stats'
import { requireSchoolScope } from '../../_lib/auth-helper'
import { CollectionChartCard } from '../_components/collection-chart-card'
import { PaymentsOverview } from './_components/payments-overview'
import { PaymentsTable } from './_components/payments-table'
import { RecordPaymentButton } from './_components/record-payment-button'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.payments.title'),
  }
}

export default async function PaymentsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.payments')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const scope = await requireSchoolScope()

  if (!(await isPaymentsEnabled(scope.schoolId))) notFound()

  if (!scope.isAdmin) {
    redirect({ href: `/dashboard/families/${scope.familyId}`, locale })
  }

  const selectedPeriod = await getSelectedPeriod(scope.schoolId)
  const { currency } = await getSchoolRegionalSettings(scope.schoolId)
  const selectedPeriodId = selectedPeriod?.id ?? null

  const preferences = await db.user.findUnique({
    where: { id: scope.userId },
    select: { dashboardChartGranularity: true, dashboardChartRange: true },
  })
  const chartView = readChartView(
    preferences?.dashboardChartGranularity,
    preferences?.dashboardChartRange
  )

  const [payments, stats, families, canOpenCashier, series] = await Promise.all([
    listSchoolPayments(scope.schoolId, selectedPeriodId),
    getPaymentStats(scope.schoolId, selectedPeriodId),
    db.family.findMany({
      where: { schoolId: scope.schoolId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    isMealsEnabled(scope.schoolId),
    getCollectionSeries(scope.schoolId, selectedPeriodId, chartView),
  ])

  const paymentRows = payments.map((payment) => ({
    id: payment.id,
    familyId: payment.familyId,
    familyName: payment.lines[0].family.name,
    students: payment.lines
      .map(
        (line) =>
          `${line.enrollment.student.person.name} ${line.enrollment.student.person.lastname}`
      )
      .join(', '),
    amount: payment.amount,
    periodAmount: payment.periodAmount,
    method: payment.method,
    reference: payment.reference,
    paidAt: payment.paidAt,
    cashedAt: payment.cashedAt,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('payments') },
        ]}
        title={t('title')}
        description={t('description')}
        actions={
          <RecordPaymentButton
            families={families}
            currency={currency}
            canOpenCashier={canOpenCashier}
          />
        }
      />
      <PaymentsOverview
        stats={stats}
        locale={locale}
        currency={currency}
        periodName={selectedPeriod?.name ?? null}
        canOpenCashier={canOpenCashier}
        chart={
          <CollectionChartCard
            series={series}
            view={chartView}
            locale={locale}
            currency={currency}
            showPaymentsLink={false}
          />
        }
      />
      <PaymentsTable
        currency={currency}
        payments={paymentRows}
        locale={locale}
        periodName={selectedPeriod?.name ?? null}
      />
    </div>
  )
}
