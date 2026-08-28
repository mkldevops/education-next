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
  enrollmentId: string
  familyName: string
  studentName: string
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
    cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
    enableSorting: true,
  }

  const columns: ColumnDef<PaymentRow>[] = [
    ...(isAdmin ? [familyColumn] : []),
    {
      id: 'student',
      header: t('student'),
      accessorFn: (row) => row.studentName,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/enrollments/${row.original.enrollmentId}`}
          className="font-medium text-primary hover:text-primary-hover"
        >
          {row.original.studentName}
        </Link>
      ),
      enableSorting: true,
    },
    {
      id: 'amount',
      header: t('amount'),
      accessorFn: (row) => row.amount,
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">
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
        <span className="text-gray-700">
          <PaymentMethodLabel method={row.original.method} />
        </span>
      ),
      enableSorting: true,
    },
    {
      id: 'reference',
      header: t('reference'),
      accessorFn: (row) => row.reference ?? '-',
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
      enableSorting: true,
    },
    {
      id: 'paidAt',
      header: t('paidAt'),
      accessorFn: (row) => formatDate(row.paidAt, locale),
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
      enableSorting: true,
    },
    {
      id: 'cashedAt',
      header: t('cashedAt'),
      accessorFn: (row) => (row.cashedAt ? formatDate(row.cashedAt, locale) : '-'),
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
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
