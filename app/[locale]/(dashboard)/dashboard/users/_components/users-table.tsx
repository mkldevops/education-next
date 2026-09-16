'use client'

import { Button, RichDataTable, Select, StatusBadge } from '@peaklab/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useTableLabels } from '@/features/tables'
import { formatDate } from '@/lib/date'
import type { SchoolRole } from '@/types/enums'
import { InviteUserDialog } from './invite-user-dialog'
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
type TeacherOption = { id: string; name: string; email: string | null }

interface Props {
  members: MemberRow[]
  canManagePlatform: boolean
  currentUserId: string
  families: FamilyOption[]
  teachers?: TeacherOption[]
  locale: string
}

const ROLE_VALUES: SchoolRole[] = ['ADMIN', 'PARENT', 'TEACHER']
const ROLE_COLORS: Record<SchoolRole, 'blue' | 'green'> = {
  ADMIN: 'blue',
  PARENT: 'green',
  TEACHER: 'green',
}

export function UsersTable({
  members,
  canManagePlatform,
  currentUserId,
  families,
  teachers = [],
  locale,
}: Props) {
  const t = useTranslations('dashboard.pages.users')
  const tRoles = useTranslations('roles')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [roleFilter, setRoleFilter] = useState<'ALL' | SchoolRole>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL')

  const selectedMember = members.find((member) => member.userId === selectedId) ?? null

  const filtered = members.filter((member) => {
    if (roleFilter !== 'ALL' && member.role !== roleFilter) return false
    if (statusFilter === 'ACTIVE' && !member.user.isActive) return false
    if (statusFilter === 'ARCHIVED' && member.user.isActive) return false
    return true
  })

  const columns: ColumnDef<MemberRow>[] = [
    {
      id: 'name',
      header: t('name'),
      accessorFn: (row) => row.user.name ?? '',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-graphite">{row.original.user.name || '-'}</span>
            {row.original.user.isSuperAdmin && <StatusBadge status="red" label={t('superAdmin')} />}
          </div>
          <span className="text-xs text-graphite-600">{row.original.user.email}</span>
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
      cell: ({ row }) => <span className="text-graphite">{row.original.family?.name ?? '-'}</span>,
      enableSorting: true,
    },
    {
      id: 'lastLogin',
      header: t('lastLogin'),
      accessorFn: (row) => row.lastLoginAt?.getTime() ?? 0,
      cell: ({ row }) => (
        <span className="text-graphite">
          {row.original.lastLoginAt ? formatDate(row.original.lastLoginAt, locale) : '-'}
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

  const tableLabels = useTableLabels()
  const labels = { ...tableLabels, search: t('searchPlaceholder') }
  const hasActiveFilters = roleFilter !== 'ALL' || statusFilter !== 'ALL'

  const emptyMessage =
    members.length === 0 ? (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light text-primary">
          <Users className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-graphite">{t('empty.title')}</p>
          <p className="text-sm text-graphite-600">{t('empty.description')}</p>
        </div>
        <InviteUserDialog families={families} teachers={teachers} />
      </div>
    ) : hasActiveFilters ? (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-2">
        <div className="space-y-1">
          <p className="font-semibold text-graphite">{t('empty.filteredTitle')}</p>
          <p className="text-sm text-graphite-600">{t('empty.filteredDescription')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRoleFilter('ALL')
            setStatusFilter('ALL')
          }}
        >
          {t('empty.clearFilters')}
        </Button>
      </div>
    ) : (
      t('noUsers')
    )

  return (
    <>
      <RichDataTable
        data={filtered}
        columns={columns}
        labels={labels}
        emptyMessage={emptyMessage}
        onRowClick={(member) => {
          setSelectedId(member.userId)
          setDrawerOpen(true)
        }}
        toolbar={
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="mr-2 text-sm font-medium text-graphite-600">{t('filters')}</legend>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | SchoolRole)}
              aria-label={t('filterRole')}
              className="w-auto"
            >
              <option value="ALL">{t('schoolRoleAll')}</option>
              {ROLE_VALUES.map((role) => (
                <option key={role} value={role}>
                  {tRoles(role)}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'ARCHIVED')}
              aria-label={t('filterStatus')}
              className="w-auto"
            >
              <option value="ALL">{t('statusAll')}</option>
              <option value="ACTIVE">{t('active')}</option>
              <option value="ARCHIVED">{t('inactive')}</option>
            </Select>
          </fieldset>
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
