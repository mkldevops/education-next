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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {levels.length > 0 && periods.length > 0 && (
          <CreateClassDialog levels={levels} periods={periods} />
        )}
      </div>

      {classes.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-gray-500">{t('noClasses')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('name')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('level')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('period')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('capacity')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {classes.map((classItem) => (
                <tr key={classItem.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{classItem.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{classItem.level.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{classItem.period.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {classItem.classAssignments.length}/{classItem.capacity}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <EditClassDialog
                      classItem={{
                        id: classItem.id,
                        name: classItem.name,
                        capacity: classItem.capacity,
                      }}
                    />
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
