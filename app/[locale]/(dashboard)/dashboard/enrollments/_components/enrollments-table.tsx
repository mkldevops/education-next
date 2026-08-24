'use client'

import { BalanceBadge, RichDataTable } from '@peaklab/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { calculateRemainingBalance } from '@/domain/enrollment'
import { EnrollmentStatusBadge } from '@/features/enums'
import { useTableLabels } from '@/features/tables'
import type { EnrollmentStatus } from '@/generated/prisma/client'
import { formatCurrency } from '@/lib/decimal'
import type { EnrollmentDrawerData } from './enrollment-drawer'
import { EnrollmentDrawer } from './enrollment-drawer'

interface Props {
  enrollments: EnrollmentDrawerData[]
  isAdmin: boolean
  availableClasses: Array<{ id: string; name: string }>
  locale: string
  periodName: string | null
}

const STATUS_VALUES: EnrollmentStatus[] = ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED']

function toNumber(value: number | { toNumber?: () => number; toString: () => string }): number {
  if (typeof value === 'number') return value
  return value.toNumber ? value.toNumber() : Number(value.toString())
}

export function EnrollmentsTable({
  enrollments,
  isAdmin,
  availableClasses,
  locale,
  periodName,
}: Props) {
  const t = useTranslations('dashboard.pages.enrollments')
  const tStatus = useTranslations('status')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const selectedEnrollment = useMemo(
    () => enrollments.find((enrollment) => enrollment.id === selectedId) ?? null,
    [enrollments, selectedId]
  )
  const [statusFilter, setStatusFilter] = useState<'ALL' | EnrollmentStatus>('ALL')

  const filtered = useMemo(
    () =>
      statusFilter === 'ALL'
        ? enrollments
        : enrollments.filter((enrollment) => enrollment.status === statusFilter),
    [enrollments, statusFilter]
  )

  const columns: ColumnDef<EnrollmentDrawerData>[] = [
    {
      id: 'student',
      header: t('student'),
      accessorFn: (row) => `${row.student.person.name} ${row.student.person.lastname}`,
      cell: ({ row }) => (
        <span className="font-medium text-primary">
          {row.original.student.person.name} {row.original.student.person.lastname}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: 'plan',
      header: t('plan'),
      accessorFn: (row) => row.plan.name,
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
      enableSorting: true,
    },
    {
      id: 'status',
      header: t('status'),
      accessorFn: (row) => row.status,
      cell: ({ row }) => {
        const remaining = calculateRemainingBalance(
          toNumber(row.original.totalAmount),
          row.original.payments.reduce((sum, p) => sum + toNumber(p.amount), 0)
        )
        return (
          <div className="flex flex-wrap items-center gap-2">
            <EnrollmentStatusBadge status={row.original.status} />
            {remaining > 0 && (
              <BalanceBadge
                label={t('balanceBadge', { amount: formatCurrency(remaining, locale) })}
              />
            )}
          </div>
        )
      },
      enableSorting: true,
    },
    {
      id: 'class',
      header: t('class'),
      accessorFn: (row) => row.classAssignments.find((a) => !a.endAt)?.classPeriod.name ?? '-',
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
      enableSorting: true,
    },
    {
      id: 'totalAmount',
      header: t('totalAmount'),
      accessorFn: (row) => toNumber(row.totalAmount),
      cell: ({ row }) => (
        <span className="text-gray-700">{formatCurrency(row.original.totalAmount, locale)}</span>
      ),
      enableSorting: true,
    },
  ]

  const labels = useTableLabels()

  const handleRowClick = (enrollment: EnrollmentDrawerData) => {
    setSelectedId(enrollment.id)
    setDrawerOpen(true)
  }

  return (
    <>
      <RichDataTable
        data={filtered}
        columns={columns}
        labels={labels}
        emptyMessage={
          periodName ? t('noEnrollmentsInPeriod', { period: periodName }) : t('noEnrollments')
        }
        onRowClick={handleRowClick}
        toolbar={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | EnrollmentStatus)}
            className="border border-gray-200 rounded px-3 py-2 text-sm bg-white"
            aria-label={t('filterStatus')}
          >
            <option value="ALL">{t('statusAll')}</option>
            {STATUS_VALUES.map((status) => (
              <option key={status} value={status}>
                {tStatus(status)}
              </option>
            ))}
          </select>
        }
      />

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
