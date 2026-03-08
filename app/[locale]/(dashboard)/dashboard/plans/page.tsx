import { Breadcrumbs, Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { formatAmount } from '@/lib/decimal'
import { CreatePlanDialog } from './_components/create-plan-dialog'
import { EditPlanDialog } from './_components/edit-plan-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.plans.title'),
  }
}

export default async function PlansPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.plans')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const plans = await db.plan.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const columns: Column<(typeof plans)[0]>[] = [
    {
      key: 'name',
      header: t('name'),
    },
    {
      key: 'amount',
      header: t('amount'),
      className: 'font-medium text-gray-900',
      render: (plan) => `€${formatAmount(plan.amount)}`,
    },
    {
      key: 'enrollments',
      header: t('enrollments'),
      className: 'text-gray-700',
      render: (plan) => plan._count.enrollments,
    },
    {
      key: 'actions',
      header: t('actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (plan) => (
        <EditPlanDialog plan={{ id: plan.id, name: plan.name, amount: Number(plan.amount) }} />
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
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <CreatePlanDialog />
      </div>
      <Card className="rounded-xl border border-gray-200">
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
