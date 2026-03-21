import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { formatAmount } from '@/lib/decimal'
import { cn } from '@/lib/utils'
import { getSessionWithRole } from '../../../_lib/auth-helper'
import { DeactivateFamilyButton } from '../_components/deactivate-family-button'
import { EditFamilyDialog } from '../_components/edit-family-dialog'
import { ActivityFeed } from './_components/activity-feed'
import { ChildCard } from './_components/child-card'
import { FinancialSummary } from './_components/financial-summary'
import { HeroBanner } from './_components/hero-banner'
import { ParentsSection } from './_components/parents-section'
import { PaymentHistoryTable } from './_components/payment-history-table'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params
  const family = await db.family.findUnique({ where: { id } })
  const t = await getTranslations({ locale, namespace: 'dashboard.pages.familyDetails' })

  return {
    title: family?.name || t('title'),
  }
}

export default async function FamilyDetailPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.familyDetails')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { role, familyId } = await getSessionWithRole()
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

  if (!isAdmin && familyId !== id) notFound()

  const family = await db.family.findUnique({
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
  })

  if (!family) notFound()

  const students = family.persons.filter(
    (
      fp
    ): fp is typeof fp & {
      person: typeof fp.person & { student: NonNullable<typeof fp.person.student> }
    } => fp.person.student !== null
  )

  const allEnrollments = students.flatMap((s) => s.person.student.enrollments)
  const totalDue = allEnrollments.reduce((sum, e) => sum + Number(e.totalAmount), 0)
  const totalDiscount = allEnrollments.reduce((sum, e) => sum + Number(e.discount), 0)
  const totalPaid = family.payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const remainingBalance = totalDue - totalPaid

  const enrolledChildren = students.filter((s) => s.person.student.enrollments.length > 0).length
  const activeEnrollments = allEnrollments.filter((e) => e.status === 'ACTIVE').length

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
        showActions={isAdmin}
      >
        {isAdmin && (
          <div className="flex gap-2">
            <EditFamilyDialog
              family={{
                id: family.id,
                name: family.name,
                emergencyContact: family.emergencyContact,
                authorizedPickup: family.authorizedPickup,
              }}
            />
            <DeactivateFamilyButton familyId={family.id} />
          </div>
        )}
      </HeroBanner>

      {allEnrollments.some((e) => e.status === 'PENDING') && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-900">{t('alert.needsAttention')}</h3>
            <p className="text-sm text-amber-800 mt-1">
              {t('alert.pendingCount', {
                count: allEnrollments.filter((e) => e.status === 'PENDING').length,
              })}
            </p>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-amber-700 hover:text-amber-900 whitespace-nowrap"
          >
            {t('alert.assignNow')}
          </button>
        </div>
      )}

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
          value={`€${formatAmount(totalPaid)}`}
          icon="✓"
          color="green"
        />
        <KPICard
          label={t('kpis.remainingBalance')}
          value={`€${formatAmount(remainingBalance)}`}
          icon="⚠"
          color={remainingBalance > 0 ? 'amber' : 'green'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('sections.parentsTitle')}</h2>
          <ParentsSection persons={family.persons} />
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
        </Card>
      </div>

      {students.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('sections.childrenTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {students.map((student) => (
              <ChildCard key={student.person.id} student={student} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {family.payments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('sections.paymentsTitle')}
          </h2>
          <PaymentHistoryTable payments={family.payments} locale={locale} />
        </div>
      )}

      {allEnrollments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('sections.activityTitle')}
            </h2>
            <ActivityFeed enrollments={allEnrollments} payments={family.payments} locale={locale} />
          </div>

          {allEnrollments.some((e) => e.classAssignments.length > 0) && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('sections.assignmentsTitle')}
              </h2>
              <Card className="p-4 space-y-3">
                {allEnrollments.map((enrollment) =>
                  enrollment.classAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {assignment.classPeriod.name}
                        </p>
                        <p className="text-xs text-gray-600">
                          {assignment.classPeriod.level.name} • {assignment.classPeriod.period.name}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(assignment.startAt).toLocaleDateString(locale)}
                      </span>
                    </div>
                  ))
                )}
              </Card>
            </div>
          )}
        </div>
      )}
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
