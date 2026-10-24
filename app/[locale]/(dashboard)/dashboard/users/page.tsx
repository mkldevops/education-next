import { Breadcrumbs } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { schoolMemberGateway } from '@/gateways/school-member-gateway'
import { db } from '@/lib/db'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { requireSchoolAdmin } from '../../_lib/auth-helper'
import { restrictedPageMetadata } from '../../_lib/page-metadata'
import { InviteUserDialog } from './_components/invite-user-dialog'
import { PendingInvitations } from './_components/pending-invitations'
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

  const { schoolId, userId: viewerId, isSuperAdmin: canManagePlatform } = await requireSchoolAdmin()

  const [families, invitations, members, familyLinks, teachers, mealsEnabled] = await Promise.all([
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
    isMealsEnabled(schoolId),
  ])

  const familyByUserId: Partial<Record<string, { id: string; name: string }>> = {}
  for (const link of familyLinks) {
    if (link.userId in familyByUserId) continue
    familyByUserId[link.userId] = link.family
  }

  const memberIds = members.map((member) => member.userId)
  const lastSessions = memberIds.length
    ? await db.session.groupBy({
        by: ['userId'],
        where: { userId: { in: memberIds } },
        _max: { createdAt: true },
      })
    : []
  const lastLoginByUserId: Partial<Record<string, Date>> = Object.fromEntries(
    lastSessions.map((row) => [row.userId, row._max.createdAt ?? undefined])
  )

  const rows = members.map((member) => ({
    ...member,
    family: familyByUserId[member.userId] ?? null,
    lastLoginAt: lastLoginByUserId[member.userId] ?? null,
  }))
  const teacherOptions = teachers.map((teacher) => ({
    id: teacher.id,
    name: `${teacher.lastName} ${teacher.firstName}`.trim(),
    email: teacher.email,
  }))

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
        {rows.length > 0 && (
          <InviteUserDialog
            families={families}
            teachers={teacherOptions}
            mealsEnabled={mealsEnabled}
          />
        )}
      </div>
      <UsersTable
        members={rows}
        canManagePlatform={canManagePlatform}
        currentUserId={viewerId}
        families={families}
        teachers={teacherOptions}
        locale={locale}
        mealsEnabled={mealsEnabled}
      />

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-graphite">{tInvitations('title')}</h2>
          <p className="mt-1 text-sm text-graphite-600">{tInvitations('description')}</p>
        </div>
        <PendingInvitations
          invitations={invitations}
          locale={locale}
          roleLabels={{
            ADMIN: tRoles('ADMIN'),
            PARENT: tRoles('PARENT'),
            TEACHER: tRoles('TEACHER'),
            CASHIER: tRoles('CASHIER'),
          }}
          labels={{
            email: tInvitations('email'),
            role: tInvitations('role'),
            family: tInvitations('family'),
            expiresAt: tInvitations('expiresAt'),
            expired: tInvitations('expired'),
            actions: tInvitations('actions'),
            none: tInvitations('none'),
          }}
        />
      </div>
    </div>
  )
}
