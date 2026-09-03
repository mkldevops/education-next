'use client'

import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  StatusBadge,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import type { SchoolRole } from '@/types/enums'
import { unlinkUserFamilyAction } from '../../../_lib/user-actions'
import { ChangeSchoolMemberRoleDialog, RemoveSchoolMemberDialog } from './school-member-dialogs'
import { useUserDetail } from './use-user-detail'
import {
  ActivitySection,
  FamiliesSection,
  IdentitySection,
  Section,
  SecuritySection,
} from './user-detail-sections'
import { UserPlatformActions } from './user-platform-actions'
import type { MemberRow } from './users-table'

interface Props {
  member: MemberRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canManagePlatform: boolean
  isSelf: boolean
  families: Array<{ id: string; name: string }>
  locale: string
}

const ROLE_COLORS: Record<SchoolRole, 'blue' | 'green'> = {
  ADMIN: 'blue',
  PARENT: 'green',
}

export function UserDrawer({
  member,
  open,
  onOpenChange,
  canManagePlatform,
  isSelf,
  families,
  locale,
}: Props) {
  const t = useTranslations('dashboard.pages.users')
  const tRoles = useTranslations('roles')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { detail, loading, error, refresh } = useUserDetail(member?.userId ?? null, open)

  if (!member) return null

  const user = member.user
  const close = () => onOpenChange(false)

  const run = (action: () => Promise<string>, successKey: string) => {
    startTransition(async () => {
      const result = await action()
      if (result !== 'OK') {
        toastActionError(t, result)
        return
      }
      toast.success(t(successKey))
      router.refresh()
      await refresh()
    })
  }

  const activeSessions =
    detail?.sessions.filter((session) => new Date(session.expiresAt) > new Date()) ?? []

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-2xl">
        <DrawerHeader>
          <div className="min-w-0">
            <DrawerTitle>{user.name || user.email}</DrawerTitle>
            <p className="mt-1 truncate text-sm text-graphite-600">{user.email}</p>
          </div>
          <DrawerClose label={t('close')} />
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          {error && <div className="rounded bg-red-50 p-3 text-sm text-red-600">{t('error')}</div>}

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ROLE_COLORS[member.role]} label={tRoles(member.role)} />
            {user.isSuperAdmin && <StatusBadge status="red" label={t('superAdmin')} />}
            <StatusBadge
              status={user.isActive ? 'green' : 'gray'}
              label={user.isActive ? t('active') : t('inactive')}
            />
            <StatusBadge
              status={user.emailVerified ? 'green' : 'amber'}
              label={user.emailVerified ? t('emailVerified') : t('emailNotVerified')}
            />
            {isSelf && <StatusBadge status="blue" label={t('you')} />}
          </div>

          <IdentitySection user={user} locale={locale} />

          <Section title={t('sections.schoolActions')}>
            <div className="flex flex-wrap gap-2">
              <ChangeSchoolMemberRoleDialog userId={member.userId} role={member.role} />
              <RemoveSchoolMemberDialog userId={member.userId} onRemoved={close} />
            </div>
          </Section>

          <FamiliesSection
            detail={detail}
            canUnlink={canManagePlatform}
            isPending={isPending}
            onUnlink={(familyId) =>
              run(() => unlinkUserFamilyAction({ id: user.id, familyId }), 'familyUnlinked')
            }
          />

          <SecuritySection
            detail={detail}
            loading={loading}
            activeSessions={activeSessions}
            locale={locale}
          />

          <ActivitySection detail={detail} lastLoginAt={member.lastLoginAt} locale={locale} />

          {canManagePlatform && (
            <UserPlatformActions
              user={user}
              detail={detail}
              families={families}
              activeSessionCount={activeSessions.length}
              isPending={isPending}
              isSelf={isSelf}
              canDelete={canManagePlatform && !isSelf && !user.isActive}
              run={run}
              onClose={close}
            />
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
