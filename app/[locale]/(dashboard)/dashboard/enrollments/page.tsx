import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { getSessionWithRole } from '../../_lib/auth-helper'
import { CreateEnrollmentDialog } from './_components/create-enrollment-dialog'
import { EnrollmentsTable } from './_components/enrollments-table'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ action?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.enrollments.title'),
  }
}

export default async function EnrollmentsPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { action } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.enrollments')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { role, familyId } = await getSessionWithRole()

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

  const whereStudent = isAdmin
    ? {}
    : {
        person: {
          families: {
            some: { familyId },
          },
        },
      }

  const [students, plans, classes] = isAdmin
    ? await Promise.all([
        db.student.findMany({
          where: { isActive: true },
          include: { person: true },
          orderBy: { person: { lastname: 'asc' } },
        }),
        db.plan.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
        db.classPeriod.findMany({
          where: { isActive: true },
          include: { level: true, period: true },
          orderBy: { name: 'asc' },
        }),
      ])
    : [[], [], []]

  const studentOptions = students.map((s) => ({
    id: s.id,
    name: `${s.person.lastname} ${s.person.name}`,
  }))
  const planOptions = plans.map((p) => ({ id: p.id, name: p.name }))
  const classOptions = classes.map((c) => ({
    id: c.id,
    name: `${c.name} (${c.level.name} — ${c.period.name})`,
  }))

  const availableClasses = isAdmin
    ? await db.classPeriod.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : []

  const enrollments = await db.enrollment.findMany({
    where: { isActive: true, student: whereStudent },
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

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('enrollments') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {studentOptions.length > 0 && planOptions.length > 0 && classOptions.length > 0 && (
          <CreateEnrollmentDialog
            students={studentOptions}
            plans={planOptions}
            classes={classOptions}
            defaultOpen={action === 'create'}
          />
        )}
      </div>
      <EnrollmentsTable
        enrollments={enrollments}
        isAdmin={isAdmin}
        availableClasses={availableClasses}
        locale={locale}
      />
    </div>
  )
}
