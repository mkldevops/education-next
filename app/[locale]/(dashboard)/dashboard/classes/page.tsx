import { Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { CreateClassDialog } from './_components/create-class-dialog'
import { EditClassDialog } from './_components/edit-class-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.classes.title'),
  }
}

export default async function ClassesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.classes')

  const [levels, periods] = await Promise.all([
    db.level.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.period.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { startAt: 'desc' },
    }),
  ])

  const classes = await db.classPeriod.findMany({
    where: { isActive: true },
    include: {
      level: true,
      period: true,
      classAssignments: {
        where: {
          endAt: null,
          enrollment: { status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const columns: Column<(typeof classes)[0]>[] = [
    {
      key: 'name',
      header: t('name'),
    },
    {
      key: 'level',
      header: t('level'),
      className: 'text-gray-700',
      render: (item) => item.level.name,
    },
    {
      key: 'period',
      header: t('period'),
      className: 'text-gray-700',
      render: (item) => item.period.name,
    },
    {
      key: 'capacity',
      header: t('capacity'),
      className: 'text-gray-700',
      render: (item) => `${item.classAssignments.length}/${item.capacity}`,
    },
    {
      key: 'actions',
      header: t('actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (item) => (
        <EditClassDialog
          classItem={{
            id: item.id,
            name: item.name,
            capacity: item.capacity,
          }}
        />
      ),
    },
  ]

  return (
    <Card className="rounded-xl border border-gray-200">
      <div className="flex items-center justify-between px-6 pt-6">
        <h1 className="text-lg font-semibold text-gray-900">{t('title')}</h1>
        {levels.length > 0 && periods.length > 0 && (
          <CreateClassDialog levels={levels} periods={periods} />
        )}
      </div>
      <div className="mt-4">
        <DataTable
          data={classes}
          columns={columns}
          getRowKey={(item) => item.id}
          emptyMessage={t('noClasses')}
        />
      </div>
    </Card>
  )
}
