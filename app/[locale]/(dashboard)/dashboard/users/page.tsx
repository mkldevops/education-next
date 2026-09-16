import { Breadcrumbs, Card, type Column, DataTable } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { formatDate } from '@/lib/date'
import { db } from '@/lib/db'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { InvitationActionsCell } from './_components/invitation-actions-cell'
import { InviteUserDialog } from './_components/invite-user-dialog'
import { UsersTable } from './_components/users-table'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.users.title')
}

export default async function UsersPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.users')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')
  const tRoles = await getTranslations('roles')
  const tInvitations = await getTranslations('dashboard.pages.users.invitations')

  const { schoolId, userId: viewerId } = await requireSchoolAdmin()

  const viewer = await db.user.findUnique({
    where: { id: viewerId },
    select: { isSuperAdmin: true },
  })
  const canManagePlatform = viewer?.isSuperAdmin ?? false

  const [families, invitations, members, familyLinks, teachers] = await Promise.all([
    db.family.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.invitation.findMany({
      where: { schoolId, usedAt: null },
      include: { family: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    schoolMemberGateway.listSchoolMembers(schoolId),
    db.userFamily.findMany({
      where: { schoolId },
      select: { userId: true, family: { select: { id: true, name: true } } },
    }),
    db.teacher.findMany({
      where: { schoolId, isActive: true, userId: null },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
  ])

  const familyByUserId: Partial<Record<string, { id: string; name: string }>> = {}
  for (const link of familyLinks) {
    if (link.userId in familyByUserId) continue
    familyByUserId[link.userId] = link.family
  }

  const memberIds = members.map((member) => member.userId)
  const lastSessions = memberIds.length
    ? await db.session.findMany({
        where: { userId: { in: memberIds } },
        orderBy: { createdAt: 'desc' },
        select: { userId: true, createdAt: true },
      })
    : []
  const lastLoginByUserId: Partial<Record<string, Date>> = {}
  for (const session of lastSessions) {
    if (session.userId in lastLoginByUserId) continue
    lastLoginByUserId[session.userId] = session.createdAt
  }

  const rows = members.map((member) => ({
    ...member,
    family: familyByUserId[member.userId] ?? null,
    lastLoginAt: lastLoginByUserId[member.userId] ?? null,
  }))

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
      className: 'text-graphite',
      render: (invitation) => tRoles(invitation.role),
    },
    {
      key: 'family',
      header: tInvitations('family'),
      className: 'text-graphite',
      render: (invitation) => invitation.family?.name ?? '-',
    },
    {
      key: 'expiresAt',
      header: tInvitations('expiresAt'),
      className: 'text-graphite',
      render: (invitation) =>
        invitation.expiresAt < new Date()
          ? tInvitations('expired')
          : formatDate(invitation.expiresAt, locale),
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
        <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
        <InviteUserDialog
          families={families}
          teachers={teachers.map((teacher) => ({
            id: teacher.id,
            name: `${teacher.lastName} ${teacher.firstName}`,
            email: teacher.email,
          }))}
        />
      </div>
      <UsersTable
        members={rows}
        canManagePlatform={canManagePlatform}
        currentUserId={viewerId}
        families={families}
        locale={locale}
      />

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-graphite">{tInvitations('title')}</h2>
          <p className="mt-1 text-sm text-graphite-600">{tInvitations('description')}</p>
        </div>
        <Card className="rounded border border-alabaster-700">
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
