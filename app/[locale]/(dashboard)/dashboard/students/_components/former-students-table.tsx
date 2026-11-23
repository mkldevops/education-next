'use client'

import { RichDataTable, type RichDataTableColumnDef } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTableLabels } from '@/features/tables'
import { Link } from '@/i18n/routing'
import { formatCurrency } from '@/lib/decimal'
import type { FormerStudentRow } from '@/use-cases/students/former-students'
import { ReinstateStudentButton } from './reinstate-student-button'

type Props = {
  data: FormerStudentRow[]
  locale: string
  currency: string
  /** Le reste dû est de l'argent : masqué quand l'école coupe les paiements ou pour un enseignant. */
  showRemaining: boolean
  /** Réintégrer est réservé aux administrateurs. */
  canReinstate: boolean
}

const muted = <span className="text-graphite-600">—</span>

/** Élèves archivés : où ils en étaient, quand ils sont partis et ce qu'ils doivent encore. */
export function FormerStudentsTable({
  data,
  locale,
  currency,
  showRemaining,
  canReinstate,
}: Props) {
  const t = useTranslations('dashboard.pages.students')
  const labels = useTableLabels()
  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const columns: RichDataTableColumnDef<FormerStudentRow>[] = [
    {
      id: 'name',
      header: t('name'),
      accessorFn: (row) => row.name,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/students/${row.original.id}`}
          className="font-medium text-foreground after:absolute after:inset-0 hover:underline"
        >
          {row.original.name}
        </Link>
      ),
      enableSorting: true,
    },
    {
      id: 'family',
      header: t('family'),
      accessorFn: (row) => row.family?.name ?? '',
      cell: ({ row }) => {
        const family = row.original.family
        if (!family) return muted
        return (
          <Link
            href={`/dashboard/families/${family.id}`}
            className="relative z-10 text-foreground hover:underline"
          >
            {family.name}
          </Link>
        )
      },
      enableSorting: true,
    },
    {
      id: 'lastClass',
      header: t('lastClass'),
      accessorFn: (row) =>
        row.lastClass ? [row.lastClass.name, row.lastClass.period].filter(Boolean).join(' · ') : '',
      cell: ({ row }) => {
        const lastClass = row.original.lastClass
        if (!lastClass) return muted
        return (
          <span className="text-graphite">
            {lastClass.name}
            {lastClass.period && <span className="text-graphite-600"> · {lastClass.period}</span>}
          </span>
        )
      },
      enableSorting: true,
    },
    {
      id: 'leftAt',
      header: t('leftIn'),
      accessorFn: (row) => row.leftAt?.getTime(),
      sortUndefined: 'last',
      cell: ({ row }) =>
        row.original.leftAt ? (
          <span className="text-graphite">{monthFormat.format(row.original.leftAt)}</span>
        ) : (
          muted
        ),
      enableSorting: true,
    },
    ...(showRemaining
      ? [
          {
            id: 'remaining',
            header: t('remainingDue'),
            accessorFn: (row) => row.remaining,
            cell: ({ row }) =>
              row.original.remaining > 0 ? (
                <span className="font-medium text-amber-600 tabular-nums">
                  {formatCurrency(row.original.remaining, locale, currency)}
                </span>
              ) : (
                muted
              ),
            enableSorting: true,
          } satisfies RichDataTableColumnDef<FormerStudentRow>,
        ]
      : []),
    ...(canReinstate
      ? [
          {
            id: 'actions',
            header: t('actions'),
            cell: ({ row }) => (
              <div className="relative z-10 flex justify-end">
                <ReinstateStudentButton studentId={row.original.id} />
              </div>
            ),
          } satisfies RichDataTableColumnDef<FormerStudentRow>,
        ]
      : []),
  ]

  return (
    <RichDataTable
      data={data}
      columns={columns}
      labels={labels}
      emptyMessage={t('noFormerStudents')}
      enableSearch
      enableColumnVisibility
      enablePagination
    />
  )
}
