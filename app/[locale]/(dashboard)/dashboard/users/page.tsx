import { Breadcrumbs, Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { db } from '@/lib/db'
import { listUsers } from '@/use-cases/users/list-users'
import { requireRole } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { InvitationActionsCell } from './_components/invitation-actions-cell'
import { InviteUserDialog } from './_components/invite-user-dialog'
import { UsersTable } from './_components/users-table'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.users.title', ['ADMIN', 'SUPER_ADMIN'])
}

export default async function UsersPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.users')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')
  const tRoles = await getTranslations('roles')

  const viewer = await requireRole(['ADMIN', 'SUPER_ADMIN'])
  if (!viewer) notFound()

  const viewerRecord = await db.user.findUnique({
    where: { id: viewer.id },
    select: { role: true },
  })
  const canManageRoles = viewerRecord?.role === 'SUPER_ADMIN'

  const tInvitations = await getTranslations('dashboard.pages.users.invitations')
  const families = await db.family.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const invitations = await db.invitation.findMany({
    where: { usedAt: null },
    include: { family: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const users = await listUsers()

  const invitationColumns: Column<(typeof invitations)[number]>[] = [
    {
      key: 'email',
      header: tInvitations('email'),
      className: 'font-medium',
      render: (invitation) => invitation.email,
    },
    {
      key: 'role',
      header: tInvitations('role'),
      className: 'text-gray-700',
      render: (invitation) => tRoles(invitation.role),
    },
    {
      key: 'family',
      header: tInvitations('family'),
      className: 'text-gray-700',
      render: (invitation) => invitation.family?.name ?? '-',
    },
    {
      key: 'expiresAt',
      header: tInvitations('expiresAt'),
      className: 'text-gray-700',
      render: (invitation) =>
        invitation.expiresAt < new Date()
          ? tInvitations('expired')
          : new Date(invitation.expiresAt).toLocaleDateString(locale),
    },
    {
      key: 'actions',
      header: tInvitations('actions'),
      headerClassName: 'text-right',
      className: 'text-right',
      render: (invitation) => <InvitationActionsCell invitationId={invitation.id} />,
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('users') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <InviteUserDialog families={families} />
      </div>
      <UsersTable
        users={users}
        canManage={canManageRoles}
        currentUserId={viewer.id}
        families={families}
        locale={locale}
      />

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{tInvitations('title')}</h2>
          <p className="mt-1 text-sm text-gray-600">{tInvitations('description')}</p>
        </div>
        <Card className="rounded-xl border border-gray-200">
          <DataTable
            data={invitations}
            columns={invitationColumns}
            getRowKey={(invitation) => invitation.id}
            emptyMessage={tInvitations('none')}
          />
        </Card>
      </div>
    </div>
  )
}
