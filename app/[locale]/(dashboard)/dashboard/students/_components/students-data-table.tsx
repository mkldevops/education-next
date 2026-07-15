'use client'

import { RichDataTable, type RichDataTableLabels } from '@peaklab/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import type { Family, FamilyPerson, Person, Student } from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'

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
}

export function StudentsDataTable({ data, locale }: Props) {
  const t = useTranslations('dashboard.pages.students')

  const columns: ColumnDef<StudentRow>[] = [
    {
      id: 'name',
      header: t('name'),
      accessorFn: (row) => `${row.person.name} ${row.person.lastname}`,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/students/${row.original.id}`}
          className="text-primary hover:text-primary-hover font-medium"
        >
          {row.original.person.name} {row.original.person.lastname}
        </Link>
      ),
      enableSorting: true,
    },
    {
      id: 'birthday',
      header: t('birthday'),
      accessorFn: (row) => new Date(row.birthday).toLocaleDateString(locale),
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
      enableSorting: true,
    },
    {
      id: 'family',
      header: t('family'),
      accessorFn: (row) =>
        row.person.families.length > 0 ? row.person.families[0].family.name : '-',
      cell: ({ getValue }) => <span className="text-gray-700">{getValue() as string}</span>,
      enableSorting: true,
    },
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
    <RichDataTable data={data} columns={columns} labels={labels} emptyMessage={t('noStudents')} />
  )
}
