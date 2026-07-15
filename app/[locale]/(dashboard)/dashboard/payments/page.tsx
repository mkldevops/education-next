import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { getSessionWithRole } from '../../_lib/auth-helper'
import { PaymentsTable } from './_components/payments-table'
import { RecordPaymentDialog } from './_components/record-payment-dialog'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ action?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.payments.title'),
  }
}

export default async function PaymentsPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { action } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.payments')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { role, familyId } = await getSessionWithRole()

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

  const families = isAdmin
    ? await db.family.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []

  const selectedPeriodId = await getSelectedPeriodId()

  const whereClause = {
    isActive: true,
    ...(isAdmin ? {} : { familyId }),
    ...(selectedPeriodId
      ? {
          enrollment: {
            classAssignments: { some: { classPeriod: { periodId: selectedPeriodId } } },
          },
        }
      : {}),
  }

  const payments = await db.payment.findMany({
    where: whereClause,
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

  const paymentRows = payments.map((payment) => ({
    id: payment.id,
    enrollmentId: payment.enrollmentId,
    familyName: payment.family.name,
    studentName: `${payment.enrollment.student.person.name} ${payment.enrollment.student.person.lastname}`,
    amount: Number(payment.amount),
    method: payment.method,
    reference: payment.reference,
    paidAt: payment.paidAt,
    cashedAt: payment.cashedAt,
  }))

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('payments') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {families.length > 0 && (
          <RecordPaymentDialog families={families} defaultOpen={action === 'create'} />
        )}
      </div>
      <Card className="rounded-xl border border-gray-200">
        <PaymentsTable payments={paymentRows} locale={locale} />
      </Card>
    </div>
  )
}
