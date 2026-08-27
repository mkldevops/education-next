'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Label,
  StatusBadge,
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import type { SchoolRole } from '@/types/enums'
import {
  changePlatformLevelAction,
  changeSchoolMemberRoleAction,
  deactivateUserAction,
  getUserDetailAction,
  reactivateUserAction,
  removeSchoolMemberAction,
  revokeUserSessionsAction,
  sendPasswordResetAction,
  unlinkUserFamilyAction,
} from '../../../_lib/user-actions'
import { DeleteUserDialog } from './delete-user-dialog'
import { EditUserDialog } from './edit-user-dialog'
import { LinkFamilyDialog } from './link-family-dialog'
import type { MemberRow } from './users-table'

type UserDetail = NonNullable<Awaited<ReturnType<typeof getUserDetailAction>>>

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
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const userId = member?.userId ?? null

  useEffect(() => {
    if (!open || !userId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoading(true)
    getUserDetailAction(userId)
      .then((result) => {
        if (!cancelled) setDetail(result)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, userId])

  if (!member) return null

  const user = member.user
  const formatDate = (value: Date | string) =>
    new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })

  const run = (action: () => Promise<string>, successKey: string, close = false) => {
    startTransition(async () => {
      const result = await action()
      if (result === 'OK') {
        toast.success(t(successKey))
        router.refresh()
        if (close) onOpenChange(false)
        if (userId) {
          const refreshed = await getUserDetailAction(userId)
          setDetail(refreshed)
        }
      } else {
        toastActionError(t, result)
      }
    })
  }

  const canDelete = canManagePlatform && !isSelf && !user.isActive
  const activeSessions =
    detail?.sessions.filter((session) => new Date(session.expiresAt) > new Date()) ?? []

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-2xl">
        <DrawerHeader>
          <div className="min-w-0">
            <DrawerTitle>{user.name || user.email}</DrawerTitle>
            <p className="mt-1 truncate text-sm text-gray-500">{user.email}</p>
          </div>
          <DrawerClose label={t('close')} />
        </DrawerHeader>

        <DrawerBody className="space-y-6">
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

          <Section title={t('sections.identity')}>
            <Field label={t('name')} value={user.name || '-'} />
            <Field label={t('email')} value={user.email} />
            <Field label={t('userId')} value={user.id} mono />
            <Field label={t('createdAt')} value={formatDate(user.createdAt)} />
            <Field label={t('updatedAt')} value={formatDate(user.updatedAt)} />
          </Section>

          <Section title={t('sections.schoolActions')}>
            <div className="flex flex-wrap gap-2">
              <ChangeSchoolMemberRoleDialog userId={member.userId} role={member.role} />
              <RemoveSchoolMemberDialog
                userId={member.userId}
                onRemoved={() => onOpenChange(false)}
              />
            </div>
          </Section>

          <Section title={t('sections.families')}>
            {detail && detail.families.length === 0 && (
              <p className="text-sm text-gray-500">{t('noFamily')}</p>
            )}
            {detail?.families.map(({ family }) => (
              <div key={family.id} className="rounded border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{family.name}</p>
                    {!family.isActive && (
                      <StatusBadge status="gray" label={t('archivedFamily')} className="mt-1" />
                    )}
                  </div>
                  {canManagePlatform && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() =>
                        run(
                          () => unlinkUserFamilyAction({ id: user.id, familyId: family.id }),
                          'familyUnlinked'
                        )
                      }
                    >
                      {t('unlinkFamily')}
                    </Button>
                  )}
                </div>
                <ul className="mt-2 space-y-1">
                  {family.persons.map(({ person, relationType }) => (
                    <li key={person.id} className="text-sm text-gray-600">
                      {person.name} {person.lastname}
                      <span className="text-gray-400"> · {relationType}</span>
                      {person.student && (
                        <span className="text-gray-400">
                          {' '}
                          · {t('enrollmentCount', { count: person.student._count.enrollments })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Section>

          <Section title={t('sections.security')}>
            <Field
              label={t('activeSessions')}
              value={String(loading ? '…' : activeSessions.length)}
            />
            <Field label={t('passkeys')} value={String(detail?._count.passkeys ?? 0)} />
            <Field
              label={t('linkedAccounts')}
              value={
                detail && detail.accounts.length > 0
                  ? detail.accounts.map((account) => account.providerId).join(', ')
                  : '-'
              }
            />
            {activeSessions.length > 0 && (
              <ul className="space-y-2">
                {activeSessions.slice(0, 5).map((session) => (
                  <li key={session.id} className="rounded bg-gray-50 p-2 text-xs text-gray-600">
                    <p className="font-medium text-gray-800">{session.ipAddress || '-'}</p>
                    <p className="truncate">{session.userAgent || '-'}</p>
                    <p className="text-gray-400">
                      {formatDate(session.createdAt)} → {formatDate(session.expiresAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {detail && detail.passkeys.length > 0 && (
              <ul className="space-y-1">
                {detail.passkeys.map((passkey) => (
                  <li key={passkey.id} className="text-sm text-gray-600">
                    {passkey.name}
                    <span className="text-gray-400"> · {passkey.deviceType}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t('sections.activity')}>
            <Field
              label={t('lastLogin')}
              value={member.lastLoginAt ? formatDate(member.lastLoginAt) : t('neverConnected')}
            />
            <Field
              label={t('createdFamilies')}
              value={String(detail?._count.createdFamilies ?? 0)}
            />
            <Field
              label={t('createdInvitations')}
              value={String(detail?._count.createdInvitations ?? 0)}
            />
            <Field
              label={t('paymentTransactions')}
              value={String(detail?._count.paymentTransactions ?? 0)}
            />
            {detail && detail.createdInvitations.length > 0 && (
              <ul className="space-y-1">
                {detail.createdInvitations.map((invitation) => (
                  <li key={invitation.id} className="text-sm text-gray-600">
                    {invitation.email}
                    <span className="text-gray-400">
                      {' '}
                      · {tRoles(invitation.role)} · {formatDate(invitation.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {canManagePlatform && (
            <Section title={t('sections.platformActions')}>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={user.isSuperAdmin}
                    onChange={(event) =>
                      run(
                        () =>
                          changePlatformLevelAction({
                            id: user.id,
                            isSuperAdmin: event.target.checked,
                          }),
                        'platformLevelUpdated'
                      )
                    }
                    disabled={isPending || isSelf}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  {t('superAdmin')}
                </label>
                {isSelf && (
                  <p className="text-xs text-gray-500">{t('cannotChangeOwnPlatformLevel')}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <EditUserDialog user={user} />
                  <LinkFamilyDialog
                    userId={member.userId}
                    families={families.filter(
                      (family) => !detail?.families.some((link) => link.family.id === family.id)
                    )}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending || !user.isActive}
                    onClick={() =>
                      run(() => sendPasswordResetAction({ id: user.id }), 'passwordResetSent')
                    }
                  >
                    {t('sendPasswordReset')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending || activeSessions.length === 0}
                    onClick={() =>
                      run(() => revokeUserSessionsAction({ id: user.id }), 'sessionsRevoked')
                    }
                  >
                    {t('revokeSessions')}
                  </Button>
                  {user.isActive ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isPending || isSelf}
                      onClick={() =>
                        run(() => deactivateUserAction({ id: user.id }), 'userDeactivated')
                      }
                    >
                      {t('deactivate')}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending || isSelf}
                      onClick={() =>
                        run(() => reactivateUserAction({ id: user.id }), 'userReactivated')
                      }
                    >
                      {t('reactivate')}
                    </Button>
                  )}
                  {canDelete && (
                    <DeleteUserDialog user={user} onDeleted={() => onOpenChange(false)} />
                  )}
                </div>
              </div>
            </Section>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}

function ChangeSchoolMemberRoleDialog({ userId, role }: { userId: string; role: SchoolRole }) {
  const t = useTranslations('dashboard.pages.users')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('changeRole')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('changeRole')}</DialogTitle>
        </DialogHeader>
        <ChangeSchoolMemberRoleForm userId={userId} role={role} />
      </DialogContent>
    </Dialog>
  )
}

function ChangeSchoolMemberRoleForm({ userId, role }: { userId: string; role: SchoolRole }) {
  const t = useTranslations('dashboard.pages.users')
  const tRoles = useTranslations('roles')
  const router = useRouter()
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [selectedRole, setSelectedRole] = useState(role)

  useEffect(() => {
    setSelectedRole(role)
  }, [role])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await changeSchoolMemberRoleAction(userId, selectedRole)
      if (result === 'OK') {
        toast.success(t('memberRoleUpdated'))
        router.refresh()
        setOpen(false)
        return
      }
      toastActionError(t, result)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-2">
          <Label htmlFor="school-member-role">{t('newRole')}</Label>
          <select
            id="school-member-role"
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as SchoolRole)}
            disabled={isPending}
            className="flex h-10 w-full rounded border border-gray-300 bg-transparent px-3 py-2 text-sm"
          >
            <option value="ADMIN">{tRoles('ADMIN')}</option>
            <option value="PARENT">{tRoles('PARENT')}</option>
          </select>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t('confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function RemoveSchoolMemberDialog({
  userId,
  onRemoved,
}: {
  userId: string
  onRemoved: () => void
}) {
  const t = useTranslations('dashboard.pages.users')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="destructive" size="sm">
          {t('removeMember')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('removeMember')}</DialogTitle>
        </DialogHeader>
        <RemoveSchoolMemberForm userId={userId} onRemoved={onRemoved} />
      </DialogContent>
    </Dialog>
  )
}

function RemoveSchoolMemberForm({ userId, onRemoved }: { userId: string; onRemoved: () => void }) {
  const t = useTranslations('dashboard.pages.users')
  const router = useRouter()
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await removeSchoolMemberAction(userId)
      if (result === 'OK') {
        toast.success(t('memberRemoved'))
        router.refresh()
        setOpen(false)
        onRemoved()
        return
      }
      toastActionError(t, result)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <p className="text-sm text-gray-600">{t('removeMemberWarning')}</p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? '...' : t('confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={mono ? 'font-mono text-xs text-gray-700' : 'text-sm text-gray-900'}>
        {value}
      </span>
    </div>
  )
}
