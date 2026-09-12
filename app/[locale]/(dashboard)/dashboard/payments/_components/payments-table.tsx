'use client'

import { RichDataTable } from '@peaklab/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { PaymentMethodLabel } from '@/features/enums'
import { useTableLabels } from '@/features/tables'
import type { PaymentMethod } from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/decimal'

export interface PaymentRow {
  id: string
  familyId: string
  familyName: string
  students: string
  amount: number
  method: PaymentMethod
  reference: string | null
  paidAt: Date
  cashedAt: Date | null
}

interface Props {
  payments: PaymentRow[]
  locale: string
  isAdmin: boolean
  periodName: string | null
}

export function PaymentsTable({ payments, locale, isAdmin, periodName }: Props) {
  const t = useTranslations('dashboard.pages.payments')

  const familyColumn: ColumnDef<PaymentRow> = {
    id: 'family',
    header: t('family'),
    accessorFn: (row) => row.familyName,
    cell: ({ row }) => (
      <Link
        href={`/dashboard/families/${row.original.familyId}`}
        className="font-medium text-primary hover:text-primary-hover"
      >
        {row.original.familyName}
      </Link>
    ),
    enableSorting: true,
  }

  const columns: ColumnDef<PaymentRow>[] = [
    ...(isAdmin ? [familyColumn] : []),
    {
      id: 'students',
      header: t('students'),
      accessorFn: (row) => row.students,
      cell: ({ getValue }) => <span className="text-graphite">{getValue() as string}</span>,
      enableSorting: true,
    },
    {
      id: 'amount',
      header: t('amount'),
      accessorFn: (row) => row.amount,
      cell: ({ row }) => (
        <span className="font-medium text-graphite">
          {formatCurrency(row.original.amount, locale)}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: 'method',
      header: t('method'),
      accessorFn: (row) => row.method,
      cell: ({ row }) => (
        <span className="text-graphite">
          <PaymentMethodLabel method={row.original.method} />
        </span>
      ),
      enableSorting: true,
    },
    {
      id: 'reference',
      header: t('reference'),
      accessorFn: (row) => row.reference ?? '-',
      cell: ({ getValue }) => <span className="text-graphite">{getValue() as string}</span>,
      enableSorting: true,
    },
    {
      id: 'paidAt',
      header: t('paidAt'),
      accessorFn: (row) => row.paidAt.getTime(),
      cell: ({ row }) => (
        <span className="text-graphite">{formatDate(row.original.paidAt, locale)}</span>
      ),
      enableSorting: true,
    },
    {
      id: 'cashedAt',
      header: t('cashedAt'),
      accessorFn: (row) => row.cashedAt?.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-graphite">
          {row.original.cashedAt ? formatDate(row.original.cashedAt, locale) : '-'}
        </span>
      ),
      enableSorting: true,
    },
  ]

  const labels = useTableLabels()

  return (
    <RichDataTable
      data={payments}
      columns={columns}
      labels={labels}
      emptyMessage={periodName ? t('noPaymentsInPeriod', { period: periodName }) : t('noPayments')}
      enableSearch={isAdmin}
      enableColumnVisibility={isAdmin}
      enablePagination={isAdmin}
    />
  )
}
