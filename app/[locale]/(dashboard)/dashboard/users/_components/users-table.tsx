'use client'

import { RichDataTable, type RichDataTableLabels, StatusBadge } from '@peaklab/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import type { Role } from '@/types/enums'
import { UserDrawer } from './user-drawer'

export type UserRow = {
  id: string
  name: string | null
  email: string
  emailVerified: boolean
  image: string | null
  role: Role
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  families: Array<{ family: { id: string; name: string; isActive: boolean } }>
  sessions: Array<{ createdAt: Date }>
  _count: { sessions: number; passkeys: number; accounts: number }
}

type FamilyOption = { id: string; name: string }

interface Props {
  users: UserRow[]
  canManage: boolean
  currentUserId: string
  families: FamilyOption[]
  locale: string
}

const ROLE_VALUES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'PARENT']
const ROLE_COLORS: Record<Role, 'red' | 'blue' | 'green'> = {
  SUPER_ADMIN: 'red',
  ADMIN: 'blue',
  PARENT: 'green',
}

export function UsersTable({ users, canManage, currentUserId, families, locale }: Props) {
  const t = useTranslations('dashboard.pages.users')
  const tRoles = useTranslations('roles')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE')

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedId) ?? null,
    [users, selectedId]
  )

  const filtered = useMemo(
    () =>
      users.filter((user) => {
        if (roleFilter !== 'ALL' && user.role !== roleFilter) return false
        if (statusFilter === 'ACTIVE' && !user.isActive) return false
        if (statusFilter === 'ARCHIVED' && user.isActive) return false
        return true
      }),
    [users, roleFilter, statusFilter]
  )

  const columns: ColumnDef<UserRow>[] = [
    {
      id: 'name',
      header: t('name'),
      accessorFn: (row) => row.name ?? '',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{row.original.name || '-'}</span>
          <span className="text-xs text-gray-500">{row.original.email}</span>
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
      accessorFn: (row) => row.families.map((link) => link.family.name).join(', '),
      cell: ({ getValue }) => (
        <span className="text-gray-700">{(getValue() as string) || '-'}</span>
      ),
      enableSorting: true,
    },
    {
      id: 'lastLogin',
      header: t('lastLogin'),
      accessorFn: (row) => row.sessions[0]?.createdAt.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-gray-700">
          {row.original.sessions[0]
            ? new Date(row.original.sessions[0].createdAt).toLocaleDateString(locale)
            : '-'}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: 'status',
      header: t('status'),
      accessorFn: (row) => (row.isActive ? 'ACTIVE' : 'ARCHIVED'),
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={row.original.isActive ? 'green' : 'gray'}
            label={row.original.isActive ? t('active') : t('inactive')}
          />
          {!row.original.emailVerified && (
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
      <RichDataTable
        data={filtered}
        columns={columns}
        labels={labels}
        emptyMessage={t('noUsers')}
        onRowClick={(user) => {
          setSelectedId(user.id)
          setDrawerOpen(true)
        }}
        toolbar={
          <div className="flex flex-wrap gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | Role)}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
              aria-label={t('filterRole')}
            >
              <option value="ALL">{t('roleAll')}</option>
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
        user={selectedUser}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        canManage={canManage}
        isSelf={selectedUser?.id === currentUserId}
        families={families}
        locale={locale}
      />
    </>
  )
}
