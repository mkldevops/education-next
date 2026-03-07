import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { CreatePeriodDialog } from './_components/create-period-dialog'
import { EditPeriodDialog } from './_components/edit-period-dialog'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.periods.title'),
  }
}

export default async function PeriodsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.periods')

  const periods = await db.period.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: { classPeriods: true },
      },
    },
    orderBy: { startAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <CreatePeriodDialog />
      </div>

      {periods.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-gray-500">{t('noPeriods')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('name')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('startDate')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('endDate')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('classes')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {periods.map((period) => (
                <tr key={period.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{period.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(period.startAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(period.endAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{period._count.classPeriods}</td>
                  <td className="px-4 py-3 text-right">
                    <EditPeriodDialog period={period} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
