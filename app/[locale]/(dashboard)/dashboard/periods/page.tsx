import { Breadcrumbs, Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { isPeriodCurrent } from '@/domain/period'
import { db } from '@/lib/db'
import { requireAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { CreatePeriodDialog } from './_components/create-period-dialog'
import { EditPeriodDialog } from './_components/edit-period-dialog'
import { PromotePeriodDialog } from './_components/promote-period-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.periods.title', ['ADMIN', 'SUPER_ADMIN'])
}

export default async function PeriodsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.periods')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const user = await requireAdmin()
  if (!user) notFound()

  const periods = await db.period.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: { classPeriods: true },
      },
    },
    orderBy: { startAt: 'desc' },
  })

  const now = new Date()
  const currentPeriodId = periods.find((period) => isPeriodCurrent(period, now))?.id ?? null

  const columns: Column<(typeof periods)[number]>[] = [
    {
      key: 'name',
      header: t('name'),
      render: (period) => (
        <span className="flex items-center gap-2">
          {period.name}
          {period.id === currentPeriodId && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              {t('current')}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'startAt',
      header: t('startDate'),
      className: 'text-gray-700',
      render: (period) => new Date(period.startAt).toLocaleDateString(locale),
    },
    {
      key: 'endAt',
      header: t('endDate'),
      className: 'text-gray-700',
      render: (period) => new Date(period.endAt).toLocaleDateString(locale),
    },
    {
      key: 'classes',
      header: t('classes'),
      className: 'text-gray-700',
      render: (period) => period._count.classPeriods,
    },
    {
      key: 'actions',
      header: t('actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (period) => (
        <div className="flex justify-end gap-2">
          <PromotePeriodDialog
            sourcePeriod={period}
            targetOptions={periods.filter((candidate) => candidate.id !== period.id)}
          />
          <EditPeriodDialog period={period} classPeriodCount={period._count.classPeriods} />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('periods') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <CreatePeriodDialog />
      </div>
      {currentPeriodId === null && (
        <Card className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{t('betweenYears')}</p>
        </Card>
      )}
      <Card className="rounded-xl border border-gray-200">
        <DataTable
          data={periods}
          columns={columns}
          getRowKey={(period) => period.id}
          emptyMessage={t('noPeriods')}
        />
      </Card>
    </div>
  )
}
