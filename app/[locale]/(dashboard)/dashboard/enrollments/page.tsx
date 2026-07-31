import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { requireFamilyScope } from '../../_lib/auth-helper'
import { EnrollmentsTable } from './_components/enrollments-table'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.enrollments.title'),
  }
}

export default async function EnrollmentsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.enrollments')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const selectedPeriodId = await getSelectedPeriodId()

  const scope = await requireFamilyScope()

  const isAdmin = scope.isAdmin

  const whereStudent = scope.isAdmin
    ? {}
    : {
        person: {
          families: {
            some: { familyId: scope.familyId },
          },
        },
      }

  const availableClasses = isAdmin
    ? await db.classPeriod.findMany({
        where: { isActive: true, ...(selectedPeriodId ? { periodId: selectedPeriodId } : {}) },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []

  const enrollments = await db.enrollment.findMany({
    where: {
      isActive: true,
      student: whereStudent,
      ...(selectedPeriodId
        ? { classAssignments: { some: { classPeriod: { periodId: selectedPeriodId } } } }
        : {}),
    },
    include: {
      student: {
        include: {
          person: {
            include: {
              families: {
                include: { family: true },
              },
            },
          },
        },
      },
      plan: true,
      classAssignments: {
        include: {
          classPeriod: {
            include: {
              level: true,
              period: true,
            },
          },
        },
      },
      payments: {
        orderBy: { paidAt: 'desc' },
      },
    },
    orderBy: { registeredAt: 'desc' },
  })

  const serializableEnrollments = enrollments.map((enrollment) => ({
    ...enrollment,
    totalAmount: Number(enrollment.totalAmount),
    discount: Number(enrollment.discount),
    plan: { ...enrollment.plan, amount: Number(enrollment.plan.amount) },
    payments: enrollment.payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount),
    })),
  }))

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('enrollments') },
        ]}
      />
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <EnrollmentsTable
        enrollments={serializableEnrollments}
        isAdmin={isAdmin}
        availableClasses={availableClasses}
        locale={locale}
      />
    </div>
  )
}
