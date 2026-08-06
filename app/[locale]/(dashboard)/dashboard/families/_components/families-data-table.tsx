'use client'

import { RichDataTable, type RichDataTableLabels } from '@peaklab/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

export type FamilyRow = {
  id: string
  name: string
  emergencyContact: string | null
  studentCount: number
  enrollmentCount: number
}

type Props = {
  data: FamilyRow[]
}

export function FamiliesDataTable({ data }: Props) {
  const t = useTranslations('dashboard.pages.families')

  const columns: ColumnDef<FamilyRow>[] = [
    {
      id: 'name',
      header: t('name'),
      accessorFn: (row) => row.name,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/families/${row.original.id}`}
          className="font-medium text-primary after:absolute after:inset-0 hover:text-primary-hover"
        >
          {row.original.name}
        </Link>
      ),
      enableSorting: true,
    },
    {
      id: 'emergencyContact',
      header: t('emergencyContact'),
      accessorFn: (row) => row.emergencyContact || '-',
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
      enableSorting: true,
    },
    {
      id: 'studentCount',
      header: t('students'),
      accessorFn: (row) => row.studentCount,
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as number}</span>,
      enableSorting: true,
    },
    {
      id: 'enrollmentCount',
      header: t('enrollments'),
      accessorFn: (row) => row.enrollmentCount,
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as number}</span>,
      enableSorting: true,
    },
  ]

  const labels: RichDataTableLabels = {
    search: t('table.search'),
    noResults: t('table.noResults'),
    columns: t('table.columns'),
    rowsPerPage: t('table.rowsPerPage'),
    previous: t('table.previous'),
    next: t('table.next'),
    page: (current, total) => t('table.page', { current, total }),
  }

  return (
    <RichDataTable data={data} columns={columns} labels={labels} emptyMessage={t('noFamilies')} />
  )
}
