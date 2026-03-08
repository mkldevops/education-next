import { Breadcrumbs, Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { formatAmount } from '@/lib/decimal'
import { getSessionWithRole } from '../../_lib/auth-helper'
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

  const whereClause = isAdmin ? { isActive: true } : { isActive: true, familyId }

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

  const columns: Column<(typeof payments)[0]>[] = [
    {
      key: 'family',
      header: t('family'),
      render: (payment) => payment.family.name,
    },
    {
      key: 'student',
      header: t('student'),
      render: (payment) =>
        `${payment.enrollment.student.person.name} ${payment.enrollment.student.person.lastname}`,
      className: 'text-gray-700',
    },
    {
      key: 'amount',
      header: t('amount'),
      render: (payment) => `€${formatAmount(payment.amount)}`,
      className: 'font-medium text-gray-900',
    },
    {
      key: 'method',
      header: t('method'),
      render: (payment) => payment.method,
      className: 'text-gray-700',
    },
    {
      key: 'reference',
      header: t('reference'),
      render: (payment) => payment.reference || '-',
      className: 'text-gray-700',
    },
    {
      key: 'paidAt',
      header: t('paidAt'),
      render: (payment) => new Date(payment.paidAt).toLocaleDateString(locale),
      className: 'text-gray-700',
    },
    {
      key: 'cashedAt',
      header: t('cashedAt'),
      render: (payment) =>
        payment.cashedAt ? new Date(payment.cashedAt).toLocaleDateString(locale) : '-',
      className: 'text-gray-700',
    },
  ]

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
        <DataTable
          data={payments}
          columns={columns}
          getRowKey={(payment) => payment.id}
          emptyMessage={t('noPayments')}
        />
      </Card>
    </div>
  )
}
