import { Card, type Column, DataTable, ProgressBar, StatusDot } from '@peaklab/ui'
import { AlertCircle, TrendingUp, Users } from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { Link } from '@/i18n/routing'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { isStripeConfigured } from '@/lib/stripe'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'
import { requireFamilyScope } from '../_lib/auth-helper'
import { OnlinePaymentButton } from './families/[id]/_components/online-payment-button'

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
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard')
  const tStatus = await getTranslations('status')

  const session = await auth.api.getSession({ headers: await headers() })
  const scope = await requireFamilyScope()

  const isAdmin = scope.isAdmin

  const selectedPeriodId = await getSelectedPeriodId()
  const periodFilter = selectedPeriodId
    ? { classAssignments: { some: { classPeriod: { periodId: selectedPeriodId } } } }
    : {}

  const [familyCount, studentCount, enrollmentCount, pendingPaymentCount, recentEnrollments] =
    await Promise.all([
      db.family.count({
        where: {
          isActive: true,
          ...(scope.isAdmin ? {} : { id: scope.familyId }),
        },
      }),
      db.student.count({
        where: {
          isActive: true,
          person: {
            families: {
              some: scope.isAdmin ? {} : { familyId: scope.familyId },
            },
          },
        },
      }),
      db.enrollment.count({
        where: {
          status: { in: ['PENDING', 'ACTIVE'] },
          isActive: true,
          ...periodFilter,
          student: {
            person: {
              families: {
                some: scope.isAdmin ? {} : { familyId: scope.familyId },
              },
            },
          },
        },
      }),
      db.enrollment.count({
        where: {
          status: 'PENDING',
          isActive: true,
          ...periodFilter,
          student: {
            person: {
              families: {
                some: scope.isAdmin ? {} : { familyId: scope.familyId },
              },
            },
          },
        },
      }),
      db.enrollment.findMany({
        where: {
          isActive: true,
          ...periodFilter,
          ...(scope.isAdmin
            ? {}
            : {
                student: {
                  person: {
                    families: {
                      some: { familyId: scope.familyId },
                    },
                  },
                },
              }),
        },
        include: {
          student: {
            include: {
              person: true,
            },
          },
          plan: true,
          payments: true,
        },
        orderBy: { registeredAt: 'desc' },
        take: 5,
      }),
    ])

  const selectedPeriod = selectedPeriodId
    ? await db.period.findUnique({ where: { id: selectedPeriodId }, select: { name: true } })
    : null
  const periodScope = selectedPeriod
    ? t('stats.scopePeriod', { period: selectedPeriod.name })
    : t('stats.scopeAll')

  const userName = session?.user.name || 'User'
  const parentBalance = !scope.isAdmin ? await getFamilyBalance(scope.familyId) : null

  const enrollmentColumns: Column<(typeof recentEnrollments)[number]>[] = [
    {
      key: 'student',
      header: t('table.student'),
      render: (item) => (
        <span className="font-medium">
          {item.student.person.name} {item.student.person.lastname}
        </span>
      ),
    },
    {
      key: 'plan',
      header: t('table.plan'),
      className: 'text-gray-600',
      render: (item) => item.plan.name,
    },
    {
      key: 'status',
      header: t('table.status'),
      render: (item) => (
        <StatusDot
          color={item.status === 'ACTIVE' ? 'green' : 'amber'}
          label={tStatus(item.status)}
        />
      ),
    },
    {
      key: 'payment',
      header: t('table.payment'),
      render: (item) => {
        const finalAmount = Number(item.totalAmount)
        const totalPaid = item.payments.reduce((sum, p) => sum + Number(p.amount), 0)
        const ratio = finalAmount > 0 ? (totalPaid / finalAmount) * 100 : 0
        return <ProgressBar value={ratio} />
      },
    },
    {
      key: 'date',
      header: t('table.date'),
      className: 'text-gray-600',
      render: (item) => new Date(item.registeredAt).toLocaleDateString(locale),
    },
  ]

  return (
    <div className="space-y-8">
      <div className="-mx-6 -mt-16 bg-gradient-to-br from-stormy-teal-900 via-yale-blue-900 to-alabaster-800 px-6 pb-20 pt-16">
        <h1 className="text-3xl font-bold text-graphite">{t('greeting', { name: userName })}</h1>
        <p className="mt-2 text-graphite-600">
          {t(isAdmin ? 'greetingSubtitle' : 'parentGreetingSubtitle')}
        </p>

        {isAdmin && (
          <div className="mt-6 max-w-sm">
            <Link
              href="/dashboard/families?action=create"
              className="block p-4 rounded-xl border border-white/60 bg-white/80 backdrop-blur-sm hover:bg-white transition"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-900">{t('quickActions.newFamily')}</span>
              </div>
            </Link>
          </div>
        )}
      </div>

      <div
        className={
          isAdmin
            ? '-mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4'
            : '-mt-14 grid gap-5 md:grid-cols-3'
        }
      >
        {isAdmin && (
          <Card className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('stats.families')}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{familyCount}</p>
                <p className="mt-1 text-xs text-gray-400">{t('stats.scopeAll')}</p>
              </div>
              <div className="rounded-lg bg-teal-100 p-3">
                <TrendingUp className="h-6 w-6 text-teal-600" />
              </div>
            </div>
          </Card>
        )}
        <Card className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('stats.students')}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{studentCount}</p>
              <p className="mt-1 text-xs text-gray-400">{t('stats.scopeAll')}</p>
            </div>
            <div className="rounded-lg bg-teal-100 p-3">
              <TrendingUp className="h-6 w-6 text-teal-600" />
            </div>
          </div>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('stats.enrollments')}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{enrollmentCount}</p>
              <p className="mt-1 text-xs text-gray-400">{periodScope}</p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
        {isAdmin ? (
          <Card className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('stats.pendingEnrollments')}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{pendingPaymentCount}</p>
                <p className="mt-1 text-xs text-gray-400">{periodScope}</p>
              </div>
              <div className="rounded-lg bg-amber-100 p-3">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </Card>
        ) : (
          <Card className="rounded-xl border border-amber-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-600">{t('stats.remainingBalance')}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {formatCurrency(parentBalance?.remainingBalance ?? 0, locale)}
            </p>
            <p className="mt-1 text-xs text-gray-400">{t('stats.scopeAll')}</p>
            <div className="mt-4">
              <OnlinePaymentButton
                amount={parentBalance?.payableBalance ?? 0}
                outstanding={parentBalance?.remainingBalance ?? 0}
                configured={isStripeConfigured()}
                locale={locale}
              />
            </div>
          </Card>
        )}
      </div>

      <Card className="rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">{t('recentEnrollments')}</h2>
          <Link
            href={isAdmin ? '/dashboard/enrollments' : `/dashboard/families/${scope.familyId}`}
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            {t(isAdmin ? 'viewAll' : 'viewFamily')}
          </Link>
        </div>

        {recentEnrollments.length === 0 ? (
          <p className="px-6 pb-6 pt-4 text-gray-500">{t('pages.enrollments.noEnrollments')}</p>
        ) : (
          <div className="mt-4">
            <DataTable
              data={recentEnrollments}
              columns={enrollmentColumns}
              getRowKey={(item) => item.id}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
