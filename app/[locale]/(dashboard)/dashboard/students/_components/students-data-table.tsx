'use client'

import { RichDataTable } from '@peaklab/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { useTableLabels } from '@/features/tables'
import type { Family, FamilyPerson, Person, Student } from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'
import { formatDate } from '@/lib/date'

type StudentRow = Student & {
  person: Person & {
    families: (FamilyPerson & { family: Family })[]
  }
  enrollments: {
    classAssignments: {
      classPeriod: { name: string }
    }[]
  }[]
}

type Props = {
  data: StudentRow[]
  locale: string
  isAdmin: boolean
}

export function StudentsDataTable({ data, locale, isAdmin }: Props) {
  const t = useTranslations('dashboard.pages.students')

  const familyColumn: ColumnDef<StudentRow> = {
    id: 'family',
    header: t('family'),
    accessorFn: (row) =>
      row.person.families.length > 0 ? row.person.families[0].family.name : '-',
    cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
    enableSorting: true,
  }

  const columns: ColumnDef<StudentRow>[] = [
    {
      id: 'name',
      header: t('name'),
      accessorFn: (row) => `${row.person.name} ${row.person.lastname}`,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/students/${row.original.id}`}
          className="font-medium text-primary after:absolute after:inset-0 hover:text-primary-hover"
        >
          {row.original.person.name} {row.original.person.lastname}
        </Link>
      ),
      enableSorting: true,
    },
    {
      id: 'birthday',
      header: t('birthday'),
      accessorFn: (row) => formatDate(row.birthday, locale),
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
      enableSorting: true,
    },
    ...(isAdmin ? [familyColumn] : []),
    {
      id: 'class',
      header: t('class'),
      accessorFn: (row) =>
        row.enrollments.length > 0 && row.enrollments[0].classAssignments.length > 0
          ? row.enrollments[0].classAssignments[0].classPeriod.name
          : '-',
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
      enableSorting: true,
    },
  ]

  const labels = useTableLabels()

  return (
    <RichDataTable
      data={data}
      columns={columns}
      labels={labels}
      emptyMessage={t('noStudents')}
      enableSearch={isAdmin}
      enableColumnVisibility={isAdmin}
      enablePagination={isAdmin}
    />
  )
}
