import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.levels.title'),
  }
}

export default async function LevelsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.levels')

  const levels = await db.level.findMany({
    where: { isActive: true },
    include: {
      nextLevel: true,
      _count: {
        select: { classPeriods: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      {levels.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-gray-500">{t('noLevels')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('name')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('nextLevel')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('classes')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {levels.map((level) => (
                <tr key={level.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{level.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {level.nextLevel?.name || t('none')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{level._count.classPeriods}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
