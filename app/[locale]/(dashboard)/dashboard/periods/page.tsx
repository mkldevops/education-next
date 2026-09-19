import { Breadcrumbs, Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { isPeriodCurrent } from '@/domain/period'
import { formatDate } from '@/lib/date'
import { db } from '@/lib/db'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { CreatePeriodDialog } from './_components/create-period-dialog'
import { PeriodRowActions } from './_components/period-row-actions'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.periods.title')
}

export default async function PeriodsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.periods')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId } = await requireSchoolAdmin()

  const periods = await db.period.findMany({
    where: { schoolId, isActive: true },
    include: {
      _count: {
        select: { classPeriods: true },
      },
    },
    orderBy: { startAt: 'desc' },
  })

  const now = new Date()
  const currentPeriodId = periods.find((period) => isPeriodCurrent(period, now))?.id ?? null

  const periodsByStartAsc = [...periods].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())

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
      className: 'text-graphite',
      render: (period) => formatDate(period.startAt, locale),
    },
    {
      key: 'endAt',
      header: t('endDate'),
      className: 'text-graphite',
      render: (period) => formatDate(period.endAt, locale),
    },
    {
      key: 'classes',
      header: t('classes'),
      className: 'text-graphite',
      render: (period) => period._count.classPeriods,
    },
    {
      key: 'actions',
      header: t('actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (period) => {
        const targetOptions = periodsByStartAsc
          .filter((candidate) => candidate.startAt > period.startAt)
          .map(({ id, name }) => ({ id, name }))
        return (
          <PeriodRowActions
            period={period}
            targetOptions={targetOptions}
            classPeriodCount={period._count.classPeriods}
          />
        )
      },
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
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <CreatePeriodDialog />
      </div>
      {currentPeriodId === null && (
        <Card className="rounded border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{t('betweenYears')}</p>
        </Card>
      )}
      <Card className="rounded border border-alabaster-700">
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
