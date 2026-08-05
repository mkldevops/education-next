import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cache } from 'react'
import { Tabs } from '@/components/ui/tabs/tabs'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { isStripeConfigured } from '@/lib/stripe'
import { cn } from '@/lib/utils'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'
import { getSessionWithRole } from '../../../_lib/auth-helper'
import { CreateEnrollmentDialog } from '../../enrollments/_components/create-enrollment-dialog'
import { RecordPaymentDialog } from '../../payments/_components/record-payment-dialog'
import { CreateStudentDialog } from '../../students/_components/create-student-dialog'
import { DeactivateFamilyButton } from '../_components/deactivate-family-button'
import { EditFamilyDialog } from '../_components/edit-family-dialog'
import { ActivityFeed } from './_components/activity-feed'
import { ChildCard } from './_components/child-card'
import { FinancialSummary } from './_components/financial-summary'
import { HeroBanner } from './_components/hero-banner'
import { OnlinePaymentButton } from './_components/online-payment-button'
import { ParentsSection } from './_components/parents-section'
import { PaymentHistoryTable } from './_components/payment-history-table'

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
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard label={t('kpis.enrolledChildren')} value={enrolledChildren} icon="👶" />
                  <KPICard
                    label={t('kpis.totalEnrollments')}
                    value={allEnrollments.length}
                    subValue={`${activeEnrollments} ${t('kpis.active')}`}
                    icon="📚"
                  />
                  <KPICard
                    label={t('kpis.totalPaid')}
                    value={formatCurrency(totalPaid, locale)}
                    icon="✓"
                    color="green"
                  />
                  <KPICard
                    label={t('kpis.remainingBalance')}
                    value={formatCurrency(remainingBalance, locale)}
                    icon="⚠"
                    color={remainingBalance > 0 ? 'amber' : 'green'}
                  />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                      {t('sections.parentsTitle')}
                    </h2>
                    <ParentsSection
                      persons={family.persons}
                      familyId={family.id}
                      isAdmin={isAdmin}
                      linkedEmails={family.users.map(({ user }) => user.email)}
                    />
                  </Card>
                  <Card className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                      {t('sections.financialTitle')}
                    </h2>
                    <FinancialSummary
                      totalDue={totalDue}
                      totalPaid={totalPaid}
                      totalDiscount={totalDiscount}
                      remainingBalance={remainingBalance}
                    />
                    {!isAdmin && (
                      <div className="mt-5 border-t border-gray-200 pt-5">
                        <OnlinePaymentButton
                          amount={payableBalance}
                          configured={isStripeConfigured()}
                          locale={locale}
                        />
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            ),
          },
          {
            label: t('tabs.children'),
            content: (
              <div className="space-y-4">
                {allEnrollments.some((e) => e.status === 'PENDING') && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-amber-900">
                        {t('alert.needsAttention')}
                      </h3>
                      <p className="text-sm text-amber-800 mt-1">
                        {t('alert.pendingCount', {
                          count: allEnrollments.filter((e) => e.status === 'PENDING').length,
                        })}
                      </p>
                    </div>
                  </div>
                )}
                {students.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {students.map((student) => (
                      <ChildCard
                        key={student.person.id}
                        student={student}
                        locale={locale}
                        familyId={family.id}
                        isAdmin={isAdmin}
                        classes={classOptions}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    {t('sections.noChildren')}
                  </p>
                )}
              </div>
            ),
          },
          {
            label: t('tabs.payments'),
            content: (
              <div className="space-y-6">
                <PaymentHistoryTable payments={family.payments} locale={locale} />
              </div>
            ),
          },
          {
            label: t('tabs.activity'),
            content: (
              <div className="space-y-6">
                {allEnrollments.length > 0 ? (
                  <ActivityFeed
                    enrollments={allEnrollments}
                    payments={family.payments}
                    locale={locale}
                  />
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    {t('sections.noActivity')}
                  </p>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

function KPICard({
  label,
  value,
  subValue,
  icon,
  color = 'gray',
}: {
  label: string
  value: string | number
  subValue?: string
  icon?: string
  color?: 'gray' | 'green' | 'amber'
}) {
  const bgColor = {
    gray: 'bg-gray-50',
    green: 'bg-green-50',
    amber: 'bg-amber-50',
  }[color]

  const textColor = {
    gray: 'text-gray-900',
    green: 'text-green-900',
    amber: 'text-amber-900',
  }[color]

  const subTextColor = {
    gray: 'text-gray-600',
    green: 'text-green-700',
    amber: 'text-amber-700',
  }[color]

  return (
    <Card className={cn('p-4 rounded-xl border', bgColor)}>
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-600">{label}</p>
          <p className={cn('text-2xl font-bold', textColor)}>{value}</p>
          {subValue && <p className={cn('text-xs', subTextColor)}>{subValue}</p>}
        </div>
      </div>
    </Card>
  )
}
