'use client'

import { RichDataTable, type RichDataTableLabels, StatusBadge } from '@peaklab/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import type { SchoolRole } from '@/types/enums'
import { UserDrawer } from './user-drawer'

export type MemberRow = {
  userId: string
  role: SchoolRole
  createdAt: Date
  user: {
    id: string
    name: string | null
    email: string
    emailVerified: boolean
    image: string | null
    isSuperAdmin: boolean
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }
  family: { id: string; name: string } | null
  lastLoginAt: Date | null
}

type FamilyOption = { id: string; name: string }

interface Props {
  members: MemberRow[]
  canManagePlatform: boolean
  currentUserId: string
  families: FamilyOption[]
  locale: string
}

const ROLE_VALUES: SchoolRole[] = ['ADMIN', 'PARENT']
const ROLE_COLORS: Record<SchoolRole, 'blue' | 'green'> = {
  ADMIN: 'blue',
  PARENT: 'green',
}

export function UsersTable({ members, canManagePlatform, currentUserId, families, locale }: Props) {
  const t = useTranslations('dashboard.pages.users')
  const tRoles = useTranslations('roles')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [roleFilter, setRoleFilter] = useState<'ALL' | SchoolRole>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE')

  const selectedMember = useMemo(
    () => members.find((member) => member.userId === selectedId) ?? null,
    [members, selectedId]
  )

  const filtered = useMemo(
    () =>
      members.filter((member) => {
        if (roleFilter !== 'ALL' && member.role !== roleFilter) return false
        if (statusFilter === 'ACTIVE' && !member.user.isActive) return false
        if (statusFilter === 'ARCHIVED' && member.user.isActive) return false
        return true
      }),
    [members, roleFilter, statusFilter]
  )

  const columns: ColumnDef<MemberRow>[] = [
    {
      id: 'name',
      header: t('name'),
      accessorFn: (row) => row.user.name ?? '',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{row.original.user.name || '-'}</span>
            {row.original.user.isSuperAdmin && <StatusBadge status="red" label={t('superAdmin')} />}
          </div>
          <span className="text-xs text-gray-500">{row.original.user.email}</span>
        </div>
      ),
      enableSorting: true,
    },
    {
      id: 'role',
      header: t('role'),
      accessorFn: (row) => row.role,
      cell: ({ row }) => (
        <StatusBadge status={ROLE_COLORS[row.original.role]} label={tRoles(row.original.role)} />
      ),
      enableSorting: true,
    },
    {
      id: 'family',
      header: t('family'),
      accessorFn: (row) => row.family?.name ?? '',
      cell: ({ row }) => <span className="text-gray-700">{row.original.family?.name ?? '-'}</span>,
      enableSorting: true,
    },
    {
      id: 'lastLogin',
      header: t('lastLogin'),
      accessorFn: (row) => row.lastLoginAt?.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-gray-700">
          {row.original.lastLoginAt
            ? new Date(row.original.lastLoginAt).toLocaleDateString(locale)
            : '-'}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: 'status',
      header: t('status'),
      accessorFn: (row) => (row.user.isActive ? 'ACTIVE' : 'ARCHIVED'),
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={row.original.user.isActive ? 'green' : 'gray'}
            label={row.original.user.isActive ? t('active') : t('inactive')}
          />
          {!row.original.user.emailVerified && (
            <StatusBadge status="amber" label={t('emailNotVerified')} />
          )}
        </div>
      ),
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
    <>
      {/*
        `key` force le remontage quand un filtre du parent change. `RichDataTable`
        réagit à son état interne — la recherche fonctionne — mais pas à un nouveau
        tableau `data` : mesuré props `data` à 1 ligne pour 2 lignes rendues. Le
        défaut est dans le composant partagé, suivi séparément ; sans ce remontage,
        les deux sélecteurs ci-dessous n'auraient aucun effet.
      */}
      <RichDataTable
        key={`${roleFilter}-${statusFilter}`}
        data={filtered}
        columns={columns}
        labels={labels}
        emptyMessage={t('noUsers')}
        onRowClick={(member) => {
          setSelectedId(member.userId)
          setDrawerOpen(true)
        }}
        toolbar={
          <div className="flex flex-wrap gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | SchoolRole)}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
              aria-label={t('filterRole')}
            >
              <option value="ALL">{t('schoolRoleAll')}</option>
              {ROLE_VALUES.map((role) => (
                <option key={role} value={role}>
                  {tRoles(role)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'ARCHIVED')}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
              aria-label={t('filterStatus')}
            >
              <option value="ACTIVE">{t('active')}</option>
              <option value="ARCHIVED">{t('inactive')}</option>
              <option value="ALL">{t('statusAll')}</option>
            </select>
          </div>
        }
      />

      <UserDrawer
        member={selectedMember}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        canManagePlatform={canManagePlatform}
        isSelf={selectedMember?.userId === currentUserId}
        families={families}
        locale={locale}
      />
    </>
  )
}
