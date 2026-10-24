'use client'

import {
  BalanceBadge,
  RichDataTable,
  type RichDataTableColumnDef,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { calculateRemainingBalance } from '@/domain/enrollment'
import { totalPaidAmount } from '@/domain/payment'
import { EnrollmentStatusBadge } from '@/features/enums'
import { useTableLabels } from '@/features/tables'
import type { EnrollmentStatus } from '@/generated/prisma/client'
import { formatCurrency, toNumber } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import type { EnrollmentDrawerData } from './enrollment-drawer'
import { EnrollmentDrawer } from './enrollment-drawer'

interface Props {
  enrollments: EnrollmentDrawerData[]
  isAdmin: boolean
  availableClasses: Array<{ id: string; name: string }>
  availablePlans: Array<{ id: string; name: string }>
  paymentsEnabled: boolean
  locale: string
  currency: string
  periodName: string | null
}

const STATUS_VALUES: EnrollmentStatus[] = ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED']

export function EnrollmentsTable({
  enrollments,
  isAdmin,
  availableClasses,
  availablePlans,
  paymentsEnabled,
  locale,
  currency,
  periodName,
}: Props) {
  const t = useTranslations('dashboard.pages.enrollments')
  const tStatus = useTranslations('status')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const selectedEnrollment = enrollments.find((enrollment) => enrollment.id === selectedId) ?? null
  const [statusFilter, setStatusFilter] = useState<'ALL' | EnrollmentStatus>('ALL')
  const statusItems: Array<{ value: 'ALL' | EnrollmentStatus; label: string }> = [
    { value: 'ALL', label: t('statusAll') },
    ...STATUS_VALUES.map((status) => ({ value: status, label: tStatus(status) })),
  ]

  const filtered =
    statusFilter === 'ALL'
      ? enrollments
      : enrollments.filter((enrollment) => enrollment.status === statusFilter)

  const studentColumn: RichDataTableColumnDef<EnrollmentDrawerData> = {
    id: 'student',
    header: t('student'),
    accessorFn: (row) => `${row.student.person.name} ${row.student.person.lastname}`,
    cell: ({ row }) => (
      <span className="font-medium text-primary">
        {row.original.student.person.name} {row.original.student.person.lastname}
      </span>
    ),
    enableSorting: true,
  }

  const planColumn: RichDataTableColumnDef<EnrollmentDrawerData> = {
    id: 'plan',
    header: t('plan'),
    accessorFn: (row) => row.plan.name,
    cell: ({ getValue }) =>
      getValue() === UNPRICED_PLAN_NAME ? (
        <StatusBadge status="amber" label={t('unpriced.badge')} />
      ) : (
        <span className="text-graphite">{getValue() as string}</span>
      ),
    enableSorting: true,
  }

  const statusColumn: RichDataTableColumnDef<EnrollmentDrawerData> = {
    id: 'status',
    header: t('status'),
    accessorFn: (row) => row.status,
    cell: ({ row }) => <EnrollmentStatusBadge status={row.original.status} />,
    enableSorting: true,
  }

  const classColumn: RichDataTableColumnDef<EnrollmentDrawerData> = {
    id: 'class',
    header: t('class'),
    accessorFn: (row) => row.classAssignments.find((a) => !a.endAt)?.classPeriod.level.name ?? '-',
    cell: ({ getValue }) => <span className="text-graphite">{getValue() as string}</span>,
    enableSorting: true,
  }

  const totalAmountColumn: RichDataTableColumnDef<EnrollmentDrawerData> = {
    id: 'totalAmount',
    header: t('totalAmount'),
    accessorFn: (row) => toNumber(row.totalAmount),
    // Le montant dû et ce qu'il en reste se lisent ensemble : séparer les deux obligeait à
    // faire l'aller-retour entre la colonne du statut et celle du total.
    cell: ({ row }) => {
      const remaining = calculateRemainingBalance(
        toNumber(row.original.totalAmount),
        totalPaidAmount(row.original.payments)
      )
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-graphite">
            {formatCurrency(row.original.totalAmount, locale, currency)}
          </span>
          {remaining > 0 && (
            <BalanceBadge
              label={t('balanceBadge', { amount: formatCurrency(remaining, locale, currency) })}
            />
          )}
        </div>
      )
    },
    enableSorting: true,
  }

  // Formule, statut, classe : administratif, toujours affiché. Formule et montant total
  // disparaissent drapeau coupé (FR-015) — rien à tarifer n'a rien à montrer.
  const columns: RichDataTableColumnDef<EnrollmentDrawerData>[] = [
    studentColumn,
    ...(paymentsEnabled ? [planColumn] : []),
    statusColumn,
    classColumn,
    ...(paymentsEnabled ? [totalAmountColumn] : []),
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
          <Select
            items={statusItems}
            value={statusFilter}
            onValueChange={(value) => value !== null && setStatusFilter(value)}
          >
            <SelectTrigger aria-label={t('filterStatus')} className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <EnrollmentDrawer
        enrollment={selectedEnrollment}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        isAdmin={isAdmin}
        availableClasses={availableClasses}
        availablePlans={availablePlans}
        paymentsEnabled={paymentsEnabled}
        locale={locale}
        currency={currency}
      />
    </>
  )
}
