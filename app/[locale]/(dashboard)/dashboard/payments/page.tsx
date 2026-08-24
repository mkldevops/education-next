import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { redirect } from '@/i18n/routing'
import { db } from '@/lib/db'
import { requireSchoolScope } from '../../_lib/auth-helper'
import { PaymentsTable } from './_components/payments-table'

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
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.payments')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const scope = await requireSchoolScope()

  if (!scope.isAdmin) {
    redirect({ href: `/dashboard/families/${scope.familyId}`, locale })
  }

  const selectedPeriod = await getSelectedPeriod(scope.schoolId)
  const selectedPeriodId = selectedPeriod?.id ?? null

  const whereClause = {
    schoolId: scope.schoolId,
    isActive: true,
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
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <Card className="rounded-xl border border-gray-200 p-4">
        <PaymentsTable
          payments={paymentRows}
          locale={locale}
          isAdmin
          periodName={selectedPeriod?.name ?? null}
        />
      </Card>
    </div>
  )
}
