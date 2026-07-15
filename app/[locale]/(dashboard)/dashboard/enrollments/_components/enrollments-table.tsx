'use client'

import { BalanceBadge, Card, type Column, DataTable, StatusBadge } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { calculateRemainingBalance } from '@/domain/enrollment'
import { formatAmount } from '@/lib/decimal'
import type { EnrollmentDrawerData } from './enrollment-drawer'
import { EnrollmentDrawer } from './enrollment-drawer'

interface Props {
  enrollments: EnrollmentDrawerData[]
  isAdmin: boolean
  availableClasses: Array<{ id: string; name: string }>
  locale: string
}

function toNumber(value: number | { toNumber?: () => number; toString: () => string }): number {
  if (typeof value === 'number') return value
  return value.toNumber ? value.toNumber() : Number(value.toString())
}

export function EnrollmentsTable({ enrollments, isAdmin, availableClasses, locale }: Props) {
  const t = useTranslations('dashboard.pages.enrollments')
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentDrawerData | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleRowClick = (enrollment: EnrollmentDrawerData) => {
    setSelectedEnrollment(enrollment)
    setDrawerOpen(true)
  }

  const columns: Column<EnrollmentDrawerData>[] = [
    {
      key: 'student',
      header: t('student'),
      render: (enrollment) => (
        <button
          type="button"
          className="text-left font-medium text-primary hover:text-primary-hover"
          onClick={() => handleRowClick(enrollment)}
        >
          {enrollment.student.person.name} {enrollment.student.person.lastname}
        </button>
      ),
    },
    {
      key: 'plan',
      header: t('plan'),
      className: 'text-gray-700',
      render: (enrollment) => enrollment.plan.name,
    },
    {
      key: 'status',
      header: t('status'),
      render: (enrollment) => {
        const remaining = calculateRemainingBalance(
          toNumber(enrollment.totalAmount),
          toNumber(enrollment.discount),
          enrollment.payments.reduce((sum, p) => sum + toNumber(p.amount), 0)
        )
        return (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={enrollment.status} />
            {remaining > 0 && (
              <BalanceBadge label={t('balanceBadge', { amount: formatAmount(remaining) })} />
            )}
          </div>
        )
      },
    },
    {
      key: 'class',
      header: t('class'),
      className: 'text-gray-700',
      render: (enrollment) =>
        enrollment.classAssignments.length > 0
          ? enrollment.classAssignments[0].classPeriod.name
          : '-',
    },
    {
      key: 'totalAmount',
      header: t('totalAmount'),
      className: 'text-gray-700',
      render: (enrollment) => `€${formatAmount(enrollment.totalAmount)}`,
    },
  ]

  return (
    <>
      <Card className="rounded-xl border border-gray-200">
        <DataTable
          data={enrollments}
          columns={columns}
          getRowKey={(enrollment) => enrollment.id}
          emptyMessage={t('noEnrollments')}
        />
      </Card>

      <EnrollmentDrawer
        enrollment={selectedEnrollment}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        isAdmin={isAdmin}
        availableClasses={availableClasses}
        locale={locale}
      />
    </>
  )
}
