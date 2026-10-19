'use client'

import {
  RichDataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@peaklab/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useTableLabels } from '@/features/tables'
import { Link } from '@/i18n/routing'
import { ClassActionsMenu } from './class-actions-menu'

type Option = { id: string; name: string }

export interface ClassRow {
  id: string
  name: string
  levelId: string
  levelName: string
  periodName: string
  teacherNames: string[]
  teacherIds: string[]
  enrolledCount: number
  capacity: number
  /** Niveaux proposés à la modification : ceux qu'aucune autre classe de la période n'occupe. */
  editableLevels: Option[]
}

interface Props {
  classes: ClassRow[]
  levels: Option[]
  teachers: Option[]
  /** Modification et suppression, réservées à l'administration. */
  canManage: boolean
  emptyMessage: string
}

const ALL_LEVELS = 'ALL'

export function ClassesDataTable({ classes, levels, teachers, canManage, emptyMessage }: Props) {
  const t = useTranslations('dashboard.pages.classes')
  const tTable = useTranslations('common.table')
  const labels = useTableLabels()
  const [levelFilter, setLevelFilter] = useState<string>(ALL_LEVELS)

  const levelItems = [
    { value: ALL_LEVELS, label: t('levelAll') },
    ...levels.map((level) => ({ value: level.id, label: level.name })),
  ]

  const filtered =
    levelFilter === ALL_LEVELS ? classes : classes.filter((row) => row.levelId === levelFilter)

  // La recherche porte sur le nom et les enseignants : niveau et période ont leur propre filtre.
  const columns: ColumnDef<ClassRow>[] = [
    {
      id: 'name',
      header: t('name'),
      accessorFn: (row) => row.name,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/classes/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: 'level',
      header: t('level'),
      accessorFn: (row) => row.levelName,
      enableGlobalFilter: false,
      cell: ({ getValue }) => <span className="text-graphite">{getValue() as string}</span>,
    },
    {
      id: 'period',
      header: t('period'),
      accessorFn: (row) => row.periodName,
      enableGlobalFilter: false,
      cell: ({ getValue }) => <span className="text-graphite">{getValue() as string}</span>,
    },
    {
      id: 'teachers',
      header: t('teachers'),
      accessorFn: (row) => row.teacherNames.join(', '),
      cell: ({ getValue }) => (
        <span className="text-graphite">{(getValue() as string) || t('noTeachers')}</span>
      ),
    },
    {
      id: 'capacity',
      header: t('capacity'),
      accessorFn: (row) => row.enrolledCount,
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <span className="text-graphite">
          {row.original.enrolledCount}/{row.original.capacity}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('actions'),
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <ClassActionsMenu
          classItem={{
            id: row.original.id,
            name: row.original.name,
            capacity: row.original.capacity,
            levelId: row.original.levelId,
            teacherIds: row.original.teacherIds,
          }}
          levels={row.original.editableLevels}
          teachers={teachers}
        />
      ),
    },
  ]

  return (
    <RichDataTable
      data={filtered}
      columns={canManage ? columns : columns.filter((column) => column.id !== 'actions')}
      labels={labels}
      emptyMessage={levelFilter === ALL_LEVELS ? emptyMessage : tTable('noResults')}
      toolbar={
        levels.length > 0 && (
          <Select
            items={levelItems}
            value={levelFilter}
            onValueChange={(value) => value !== null && setLevelFilter(value)}
          >
            <SelectTrigger aria-label={t('filterLevel')} className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {levelItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
    />
  )
}
