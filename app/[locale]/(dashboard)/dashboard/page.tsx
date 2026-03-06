import { Card } from '@peaklab/ui'
import { AlertCircle, CreditCard, GraduationCap, Layers, TrendingUp, Users } from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSessionWithRole } from '../_lib/auth-helper'

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
  const tStatus = await getTranslations('status')

  const session = await auth.api.getSession({ headers: await headers() })
  const { roles, familyId } = await getSessionWithRole()

  const [familyCount, studentCount, enrollmentCount, pendingPaymentCount, recentEnrollments] =
    await Promise.all([
      db.family.count({
        where: {
          isActive: true,
          ...(roles.includes('admin') ? {} : { id: familyId }),
        },
      }),
      db.student.count({
        where: {
          isActive: true,
          person: {
            families: {
              some: roles.includes('admin') ? {} : { familyId },
            },
          },
        },
      }),
      db.enrollment.count({
        where: {
          status: { in: ['PENDING', 'ACTIVE'] },
          isActive: true,
          student: {
            person: {
              families: {
                some: roles.includes('admin') ? {} : { familyId },
              },
            },
          },
        },
      }),
      db.enrollment.count({
        where: {
          status: 'PENDING',
          isActive: true,
          student: {
            person: {
              families: {
                some: roles.includes('admin') ? {} : { familyId },
              },
            },
          },
        },
      }),
      db.enrollment.findMany({
        where: {
          isActive: true,
          ...(roles.includes('admin')
            ? {}
            : {
                student: {
                  person: {
                    families: {
                      some: { familyId },
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

  const userName = session?.user.name || 'User'

  return (
    <div className="space-y-8">
      <div className="-mx-6 -mt-16 bg-gradient-to-br from-stormy-teal-900 via-yale-blue-900 to-alabaster-800 px-6 pb-20 pt-16">
        <h1 className="text-3xl font-bold text-graphite">{t('greeting', { name: userName })}</h1>
        <p className="mt-2 text-graphite-600">{t('greetingSubtitle')}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/dashboard/families"
            className="block p-4 rounded-xl border border-white/60 bg-white/80 backdrop-blur-sm hover:bg-white transition"
          >
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">{t('quickActions.newFamily')}</span>
            </div>
          </Link>
          <Link
            href="/dashboard/enrollments"
            className="block p-4 rounded-xl border border-white/60 bg-white/80 backdrop-blur-sm hover:bg-white transition"
          >
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">{t('quickActions.newEnrollment')}</span>
            </div>
          </Link>
          <Link
            href="/dashboard/payments"
            className="block p-4 rounded-xl border border-white/60 bg-white/80 backdrop-blur-sm hover:bg-white transition"
          >
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">{t('quickActions.newPayment')}</span>
            </div>
          </Link>
          <Link
            href="/dashboard/students"
            className="block p-4 rounded-xl border border-white/60 bg-white/80 backdrop-blur-sm hover:bg-white transition"
          >
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">{t('quickActions.promote')}</span>
            </div>
          </Link>
        </div>
      </div>

      <div className="-mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('stats.families')}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{familyCount}</p>
            </div>
            <div className="rounded-lg bg-teal-100 p-3">
              <TrendingUp className="h-6 w-6 text-teal-600" />
            </div>
          </div>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('stats.students')}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{studentCount}</p>
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
            </div>
            <div className="rounded-lg bg-blue-100 p-3">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('stats.pendingPayments')}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{pendingPaymentCount}</p>
            </div>
            <div className="rounded-lg bg-amber-100 p-3">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('recentEnrollments')}</h2>
          <Link
            href="/dashboard/enrollments"
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            {t('viewAll')}
          </Link>
        </div>

        {recentEnrollments.length === 0 ? (
          <p className="text-gray-500">{t('pages.enrollments.noEnrollments')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t('table.student')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t('table.plan')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t('table.status')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t('table.progress')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t('table.date')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentEnrollments.map((enrollment) => {
                  const totalAmount = Number(enrollment.totalAmount)
                  const discount = Number(enrollment.discount)
                  const finalAmount = totalAmount - discount
                  const totalPaid = enrollment.payments.reduce(
                    (sum, p) => sum + Number(p.amount),
                    0
                  )
                  const paymentRatio = finalAmount > 0 ? totalPaid / finalAmount : 0
                  const isActive = enrollment.status === 'ACTIVE'

                  return (
                    <tr key={enrollment.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {enrollment.student.person.name} {enrollment.student.person.lastname}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{enrollment.plan.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isActive ? (
                            <>
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              <span className="text-green-700">{tStatus('ACTIVE')}</span>
                            </>
                          ) : (
                            <>
                              <div className="h-2 w-2 rounded-full bg-amber-500" />
                              <span className="text-amber-700">{tStatus('PENDING')}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="h-2 rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{ width: `${Math.min(paymentRatio * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-gray-600">
                            {Math.round(paymentRatio * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(enrollment.registeredAt).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
