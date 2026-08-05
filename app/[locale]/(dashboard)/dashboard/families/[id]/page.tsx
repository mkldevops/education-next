import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cache } from 'react'
import { Tabs } from '@/components/ui/tabs/tabs'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'
import { getSessionWithRole } from '../../../_lib/auth-helper'
import { CreateEnrollmentDialog } from '../../enrollments/_components/create-enrollment-dialog'
import { RecordPaymentDialog } from '../../payments/_components/record-payment-dialog'
import { CreateStudentDialog } from '../../students/_components/create-student-dialog'
import { DeactivateFamilyButton } from '../_components/deactivate-family-button'
import { EditFamilyDialog } from '../_components/edit-family-dialog'
import { ActivityTab } from './_components/activity-tab'
import { ChildrenTab } from './_components/children-tab'
import { HeroBanner } from './_components/hero-banner'
import { OverviewTab } from './_components/overview-tab'
import { PaymentsTab } from './_components/payments-tab'

type Props = {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ action?: string; studentId?: string; payment?: string; tab?: string }>
}

const TAB_KEYS = ['overview', 'children', 'payments', 'activity'] as const

const getFamilyName = cache(async (id: string) =>
  db.family.findUnique({ where: { id }, select: { name: true } }).then((f) => f?.name)
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params
  const [{ role, familyId }, t] = await Promise.all([
    getSessionWithRole(),
    getTranslations({ locale, namespace: 'dashboard.pages.familyDetails' }),
  ])
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

  if (!isAdmin && familyId !== id) return { title: t('title') }

  const name = await getFamilyName(id)
  return { title: name || t('title') }
}

export default async function FamilyDetailPage({ params, searchParams }: Props) {
  await connection()
  const { locale, id } = await params
  const { action, studentId, payment, tab } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.familyDetails')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { role, familyId } = await getSessionWithRole()
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

  if (!isAdmin && familyId !== id) notFound()

  const [family, selectedPeriodId] = await Promise.all([
    db.family.findUnique({
      where: { id },
      include: {
        persons: {
          where: { person: { isActive: true } },
          include: {
            person: {
              include: {
                student: {
                  where: { isActive: true },
                  include: {
                    enrollments: {
                      where: { isActive: true },
                      include: {
                        plan: true,
                        classAssignments: {
                          where: { endAt: null },
                          include: {
                            classPeriod: {
                              include: {
                                period: true,
                                level: true,
                              },
                            },
                          },
                        },
                        payments: {
                          where: { isActive: true },
                        },
                      },
                    },
                  },
                },
                phoneNumbers: {
                  where: { isActive: true },
                },
              },
            },
          },
        },
        users: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        payments: {
          where: { isActive: true },
          include: {
            enrollment: {
              include: {
                student: {
                  include: { person: true },
                },
                plan: true,
              },
            },
          },
          orderBy: { paidAt: 'desc' as const },
        },
      },
    }),
    getSelectedPeriodId(),
  ])

  if (!family) notFound()

  const familyBalance = await getFamilyBalance(family.id, selectedPeriodId)

  const [plans, classes] = isAdmin
    ? await Promise.all([
        db.plan.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
        db.classPeriod.findMany({
          where: { isActive: true, ...(selectedPeriodId ? { periodId: selectedPeriodId } : {}) },
          include: { level: true, period: true },
          orderBy: { name: 'asc' },
        }),
      ])
    : [[], []]

  const students = family.persons.filter(
    (
      fp
    ): fp is typeof fp & {
      person: typeof fp.person & { student: NonNullable<typeof fp.person.student> }
    } => fp.person.student !== null
  )

  const allEnrollments = students.flatMap((s) =>
    s.person.student.enrollments.map((e) => ({
      ...e,
      studentName: `${s.person.name} ${s.person.lastname}`,
    }))
  )
  const totalDue = familyBalance.totalAmount
  const totalDiscount = familyBalance.totalDiscount
  const totalPaid = familyBalance.totalPaid
  const remainingBalance = familyBalance.remainingBalance

  const enrolledChildren = students.filter((s) => s.person.student.enrollments.length > 0).length
  const activeEnrollments = allEnrollments.filter((e) => e.status === 'ACTIVE').length

  const payableBalance = allEnrollments
    .filter((e) => e.status === 'ACTIVE')
    .reduce(
      (sum, e) =>
        sum + Number(e.totalAmount) - e.payments.reduce((paid, p) => paid + Number(p.amount), 0),
      0
    )
  const scopedStudentId = students.some((s) => s.person.student.id === studentId)
    ? studentId
    : undefined

  const classOptions = classes.map((c) => ({
    id: c.id,
    name: `${c.name} (${c.level.name} — ${c.period.name})`,
  }))

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('families'), href: '/dashboard/families' },
          { label: family.name },
        ]}
      />

      <HeroBanner
        family={family}
        membersCount={family.persons.length}
        studentsCount={students.length}
        enrollmentsCount={allEnrollments.length}
        remainingBalance={remainingBalance}
        payableBalance={payableBalance}
        showActions={isAdmin}
      >
        {isAdmin && (
          <>
            <CreateEnrollmentDialog
              students={students.map((s) => ({
                id: s.person.student.id,
                name: `${s.person.lastname} ${s.person.name}`,
              }))}
              plans={plans.map((p) => ({ id: p.id, name: p.name }))}
              classes={classOptions}
              defaultOpen={action === 'addEnrollment'}
              defaultStudentId={scopedStudentId}
              redirectTo={`/dashboard/families/${family.id}`}
              showTrigger={false}
            />
            <RecordPaymentDialog
              families={[{ id: family.id, name: family.name }]}
              remainingAmount={payableBalance}
              defaultOpen={action === 'addPayment'}
              redirectTo={`/dashboard/families/${family.id}`}
              showTrigger={false}
            />
            <CreateStudentDialog
              familyId={family.id}
              defaultOpen={action === 'addStudent'}
              showTrigger={false}
            />
            <EditFamilyDialog
              family={{
                id: family.id,
                name: family.name,
                emergencyContact: family.emergencyContact,
                authorizedPickup: family.authorizedPickup,
              }}
              defaultOpen={action === 'editFamily'}
              redirectTo={`/dashboard/families/${family.id}`}
              showTrigger={false}
            />
            <DeactivateFamilyButton
              familyId={family.id}
              defaultOpen={action === 'archiveFamily'}
              redirectTo={`/dashboard/families/${family.id}`}
              showTrigger={false}
            />
          </>
        )}
      </HeroBanner>

      {payment === 'success' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {t('onlinePayment.returned')}
        </div>
      )}
      {payment === 'cancelled' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t('onlinePayment.cancelled')}
        </div>
      )}

      <Tabs
        defaultIndex={Math.max(0, TAB_KEYS.indexOf(tab as (typeof TAB_KEYS)[number]))}
        tabs={[
          {
            label: t('tabs.overview'),
            content: (
              <OverviewTab
                locale={locale}
                familyId={family.id}
                isAdmin={isAdmin}
                persons={family.persons}
                linkedEmails={family.users.map(({ user }) => user.email)}
                enrolledChildren={enrolledChildren}
                totalEnrollments={allEnrollments.length}
                activeEnrollments={activeEnrollments}
                totalPaid={totalPaid}
                remainingBalance={remainingBalance}
                totalDue={totalDue}
                totalDiscount={totalDiscount}
                payableBalance={payableBalance}
              />
            ),
          },
          {
            label: t('tabs.children'),
            content: (
              <ChildrenTab
                students={students}
                hasPendingEnrollments={allEnrollments.some((e) => e.status === 'PENDING')}
                pendingCount={allEnrollments.filter((e) => e.status === 'PENDING').length}
                locale={locale}
                familyId={family.id}
                isAdmin={isAdmin}
                classes={classOptions}
              />
            ),
          },
          {
            label: t('tabs.payments'),
            content: <PaymentsTab payments={family.payments} locale={locale} />,
          },
          {
            label: t('tabs.activity'),
            content: (
              <ActivityTab
                enrollments={allEnrollments}
                payments={family.payments}
                locale={locale}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
