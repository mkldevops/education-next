'use client'

import { RichDataTable, type RichDataTableColumnDef, useMenu } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useTableLabels } from '@/features/tables'
import type { Family, FamilyPerson, Person, Student } from '@/generated/prisma/client'
import { Link } from '@/i18n/routing'
import { calculateAge, formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/decimal'
import { CreateEnrollmentDialog } from '../../enrollments/_components/create-enrollment-dialog'
import { StudentActionsMenu } from './student-actions-menu'

export type StudentRow = Student & {
  person: Person & {
    families: (FamilyPerson & { family: Family })[]
  }
  enrollments: {
    classAssignments: {
      classPeriod: { level: { name: string } }
    }[]
  }[]
}

type Option = {
  id: string
  name: string
}

type Props = {
  data: StudentRow[]
  locale: string
  isStaff: boolean
  plans: Option[]
  classes: Option[]
  paymentsEnabled: boolean
  currency: string
  /** Date de référence de l'âge, fixée par le serveur pour que le rendu client lui soit identique. */
  today: Date
  /** Retard de la famille redevable par élève ; `null` quand les paiements sont masqués. */
  overdueAmounts?: Record<string, number> | null
  initialOverdueOnly?: boolean
}

/**
 * Âge de l'élève, la date de naissance exacte au clic.
 *
 * L'âge répond à la question posée en salle de classe ; la date sert aux dossiers, et n'a donc
 * pas besoin d'occuper une colonne entière.
 */
function AgeCell({
  birthday,
  locale,
  today,
}: {
  birthday: Date | null
  locale: string
  today: Date
}) {
  const t = useTranslations('dashboard.pages.students')
  const { open, toggle, containerRef, triggerRef, menuRef } = useMenu()

  if (!birthday) {
    return <span className="text-graphite-600">—</span>
  }

  return (
    <div className={open ? 'relative z-40' : 'relative z-10'} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        aria-expanded={open}
        className="rounded px-1 py-0.5 text-graphite hover:bg-alabaster-900"
      >
        {t('ageValue', { age: calculateAge(birthday, today) })}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full z-20 mt-2 w-max rounded border border-alabaster-700 bg-white px-3 py-2 shadow-lg"
        >
          <p className="text-xs uppercase tracking-wide text-graphite-600">{t('birthday')}</p>
          <p className="text-sm font-medium text-graphite">{formatDate(birthday, locale)}</p>
        </div>
      )}
    </div>
  )
}

export function StudentsDataTable({
  data,
  locale,
  isStaff,
  plans,
  classes,
  paymentsEnabled,
  currency,
  today,
  overdueAmounts = null,
  initialOverdueOnly = false,
}: Props) {
  const t = useTranslations('dashboard.pages.students')
  const [overdueOnly, setOverdueOnly] = useState(initialOverdueOnly)
  const overdueCount = overdueAmounts
    ? data.filter((row) => overdueAmounts[row.id] !== undefined).length
    : 0
  const rows =
    overdueAmounts && overdueOnly
      ? data.filter((row) => overdueAmounts[row.id] !== undefined)
      : data
  // Un seul dialogue pour toute la table : `key` le remonte à chaque demande d'inscription, ce qui
  // le rouvre et réinitialise le formulaire sans le dupliquer sur chaque ligne. La clé est un
  // compteur et non l'id de l'élève : refermé par « Annuler », le dialogue ne prévient pas la
  // table, et redemander le même élève doit tout de même le rouvrir.
  const [enrollRequest, setEnrollRequest] = useState<{ student: StudentRow; key: number } | null>(
    null
  )
  const enrollStudent = enrollRequest?.student ?? null

  const familyColumn: RichDataTableColumnDef<StudentRow> = {
    id: 'family',
    header: t('family'),
    accessorFn: (row) =>
      row.person.families.length > 0 ? row.person.families[0].family.name : '-',
    cell: ({ row }) => {
      const link = row.original.person.families[0]
      if (!link) return <span className="text-graphite-600">-</span>
      return (
        <Link
          href={`/dashboard/families/${link.familyId}`}
          className="relative z-10 text-foreground hover:underline"
        >
          {link.family.name}
        </Link>
      )
    },
    enableSorting: true,
  }

  const actionsColumn: RichDataTableColumnDef<StudentRow> = {
    id: 'actions',
    header: t('actions'),
    cell: ({ row }) => (
      <StudentActionsMenu
        student={row.original}
        canEnroll={row.original.enrollments.length === 0}
        onEnroll={() =>
          setEnrollRequest((previous) => ({
            student: row.original,
            key: (previous?.key ?? 0) + 1,
          }))
        }
      />
    ),
  }

  const columns: RichDataTableColumnDef<StudentRow>[] = [
    {
      id: 'name',
      header: t('name'),
      accessorFn: (row) => `${row.person.name} ${row.person.lastname}`,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/students/${row.original.id}`}
          className="font-medium text-foreground after:absolute after:inset-0 hover:underline"
        >
          {row.original.person.name} {row.original.person.lastname}
        </Link>
      ),
      enableSorting: true,
    },
    {
      id: 'age',
      header: t('age'),
      accessorFn: (row) => row.birthday?.getTime(),
      sortUndefined: 'last',
      cell: ({ row }) => <AgeCell birthday={row.original.birthday} locale={locale} today={today} />,
      enableSorting: true,
    },
    ...(isStaff ? [familyColumn] : []),
    {
      id: 'class',
      header: t('class'),
      accessorFn: (row) =>
        row.enrollments.length > 0 && row.enrollments[0].classAssignments.length > 0
          ? row.enrollments[0].classAssignments[0].classPeriod.level.name
          : '-',
      cell: ({ getValue }) => <span className="text-graphite">{getValue() as string}</span>,
      enableSorting: true,
    },
    ...(overdueAmounts
      ? [
          {
            id: 'overdue',
            header: t('overdue'),
            accessorFn: (row) => overdueAmounts[row.id],
            sortUndefined: 'last',
            cell: ({ row }) => {
              const amount = overdueAmounts[row.original.id]
              return amount === undefined ? (
                <span className="text-graphite-600">—</span>
              ) : (
                <span className="font-medium text-graphite tabular-nums">
                  {formatCurrency(amount, locale, currency)}
                </span>
              )
            },
            enableSorting: true,
          } satisfies RichDataTableColumnDef<StudentRow>,
        ]
      : []),
    ...(isStaff ? [actionsColumn] : []),
  ]

  const labels = useTableLabels()

  return (
    <>
      {overdueAmounts && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {([false, true] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={overdueOnly === value}
              onClick={() => setOverdueOnly(value)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm ${overdueOnly === value ? 'border-graphite bg-graphite text-white' : 'border-alabaster-700 bg-white text-graphite'}`}
            >
              {value ? t('filterOverdue') : t('filterAll')}
              <span className="tabular-nums opacity-70">{value ? overdueCount : data.length}</span>
            </button>
          ))}
        </div>
      )}
      <RichDataTable
        data={rows}
        columns={columns}
        labels={labels}
        emptyMessage={overdueAmounts && overdueOnly ? t('noOverdueStudents') : t('noStudents')}
        enableSearch={isStaff}
        enableColumnVisibility={isStaff}
        enablePagination={isStaff}
      />

      {enrollStudent && (
        <CreateEnrollmentDialog
          key={enrollRequest?.key}
          students={[
            {
              id: enrollStudent.id,
              name: `${enrollStudent.person.name} ${enrollStudent.person.lastname}`,
            },
          ]}
          plans={plans}
          classes={classes}
          paymentsEnabled={paymentsEnabled}
          currency={currency}
          defaultStudentId={enrollStudent.id}
          defaultOpen
          showTrigger={false}
          redirectTo="/dashboard/students"
        />
      )}
    </>
  )
}
