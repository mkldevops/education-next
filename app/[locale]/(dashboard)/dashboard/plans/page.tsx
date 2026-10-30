import { Breadcrumbs, Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { readPaymentSchedule, readPlanPricing } from '@/domain/payment-schedule'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { CreatePlanDialog } from './_components/create-plan-dialog'
import { EditPlanDialog } from './_components/edit-plan-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.plans.title')
}

export default async function PlansPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.plans')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId } = await requireSchoolAdmin()

  if (!(await isPaymentsEnabled(schoolId))) notFound()

  const { currency } = await getSchoolRegionalSettings(schoolId)

  const plans = await db.plan.findMany({
    where: { schoolId, isActive: true, name: { not: UNPRICED_PLAN_NAME } },
    include: {
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const openEnrollments = await db.enrollment.groupBy({
    by: ['planId'],
    where: { schoolId, isActive: true, status: { in: ['PENDING', 'ACTIVE'] } },
    _count: true,
  })
  const openByPlan = new Map(openEnrollments.map((row) => [row.planId, row._count]))

  const columns: Column<(typeof plans)[0]>[] = [
    {
      key: 'name',
      header: t('name'),
    },
    {
      key: 'amount',
      header: t('configuration.annual'),
      className: 'font-medium text-graphite',
      render: (plan) => {
        const pricing = readPlanPricing(plan.pricing, Number(plan.amount))
        return (
          <div>
            <p>{formatCurrency(plan.amount, locale, currency)}</p>
            {pricing.mode === 'MONTHLY' && (
              <p className="text-xs text-graphite-600">
                {t('configuration.monthlySummary', {
                  amount: formatCurrency(pricing.amount, locale, currency),
                  months: pricing.months,
                })}
              </p>
            )}
          </div>
        )
      },
    },
    {
      key: 'paymentSchedule',
      header: t('configuration.trackingTitle'),
      render: (plan) => t(`configuration.modes.${readPaymentSchedule(plan.paymentSchedule).mode}`),
    },
    {
      key: 'enrollments',
      header: t('enrollments'),
      className: 'text-graphite',
      render: (plan) => plan._count.enrollments,
    },
    {
      key: 'actions',
      header: t('actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (plan) => (
        <EditPlanDialog
          plan={{
            id: plan.id,
            name: plan.name,
            amount: Number(plan.amount),
            pricing: plan.pricing,
            paymentSchedule: plan.paymentSchedule,
          }}
          openEnrollments={openByPlan.get(plan.id) ?? 0}
          currency={currency}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('plans') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <CreatePlanDialog currency={currency} />
      </div>
      <Card className="rounded border border-alabaster-700">
        <DataTable
          data={plans}
          columns={columns}
          getRowKey={(plan) => plan.id}
          emptyMessage={t('noPlans')}
        />
      </Card>
    </div>
  )
}
