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
    title: t('pages.payments.title'),
  }
}

export default async function PaymentsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.payments')

  const payments = await db.payment.findMany({
    where: { isActive: true },
    include: {
      family: true,
      enrollment: {
        include: {
          student: {
            include: {
              person: true,
            },
          },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      {payments.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-gray-500">{t('noPayments')}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('family')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('student')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('amount')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('method')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('reference')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('paidAt')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  {t('cashedAt')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{payment.family.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {payment.enrollment.student.person.name}{' '}
                    {payment.enrollment.student.person.lastname}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    €{payment.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{payment.method}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{payment.reference || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(payment.paidAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {payment.cashedAt ? new Date(payment.cashedAt).toLocaleDateString(locale) : '-'}
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
