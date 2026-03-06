import { Card } from '@peaklab/ui'
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
    title: t('title'),
  }
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard')

  const [familyCount, studentCount, enrollmentCount, pendingPaymentCount] = await Promise.all([
    db.family.count({ where: { isActive: true } }),
    db.student.count({ where: { isActive: true } }),
    db.enrollment.count({ where: { status: { in: ['PENDING', 'ACTIVE'] }, isActive: true } }),
    db.enrollment.count({ where: { status: 'PENDING', isActive: true } }),
  ])

  const stats = [
    { key: 'families', value: familyCount },
    { key: 'students', value: studentCount },
    { key: 'enrollments', value: enrollmentCount },
    { key: 'pendingPayments', value: pendingPaymentCount },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.key} className="p-6">
            <h3 className="text-sm font-medium text-gray-500">{t(`stats.${stat.key}`)}</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">{t('welcome.title')}</h2>
        <p className="mt-2 text-gray-600">{t('welcome.description')}</p>
      </Card>
    </div>
  )
}
