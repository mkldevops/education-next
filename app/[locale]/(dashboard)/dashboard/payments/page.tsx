import { PageHeader } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { redirect } from '@/i18n/routing'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { listSchoolPayments } from '@/use-cases/payments/list-school-payments'
import { getPaymentStats } from '@/use-cases/payments/payment-stats'
import { requireSchoolScope } from '../../_lib/auth-helper'
import { PaymentsOverview } from './_components/payments-overview'
import { PaymentsTable } from './_components/payments-table'

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
  const selectedPeriodId = selectedPeriod?.id ?? null

  const [payments, stats] = await Promise.all([
    listSchoolPayments(scope.schoolId, selectedPeriodId),
    getPaymentStats(scope.schoolId, selectedPeriodId),
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
      />
      <PaymentsOverview stats={stats} locale={locale} periodName={selectedPeriod?.name ?? null} />
      <PaymentsTable
        payments={paymentRows}
        locale={locale}
        periodName={selectedPeriod?.name ?? null}
      />
    </div>
  )
}
