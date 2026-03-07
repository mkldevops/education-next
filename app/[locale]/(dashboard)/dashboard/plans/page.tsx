import type { Metadata } from 'next'
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
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.plans')

  const plans = await db.plan.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <CreatePlanDialog />
      </div>

      {plans.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-gray-500">{t('noPlans')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('name')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('amount')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('enrollments')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{plan.name}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    €{formatAmount(plan.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{plan._count.enrollments}</td>
                  <td className="px-4 py-3 text-right">
                    <EditPlanDialog
                      plan={{ id: plan.id, name: plan.name, amount: Number(plan.amount) }}
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
