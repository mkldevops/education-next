'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import type { SchoolRole } from '@/types/enums'
import { changeSchoolMemberRolesAction, removeSchoolMemberAction } from '../../../_lib/user-actions'

export function ChangeSchoolMemberRoleDialog({
  userId,
  roles,
}: {
  userId: string
  roles: readonly SchoolRole[]
}) {
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
        <ChangeSchoolMemberRoleForm key={roles.join()} userId={userId} roles={roles} />
      </DialogContent>
    </Dialog>
  )
}

const ASSIGNABLE_ROLES: SchoolRole[] = ['ADMIN', 'PARENT']

function ChangeSchoolMemberRoleForm({
  userId,
  roles,
}: {
  userId: string
  roles: readonly SchoolRole[]
}) {
  const t = useTranslations('dashboard.pages.users')
  const tRoles = useTranslations('roles')
  const router = useRouter()
  const { isPending, close, onSubmit } = useDialogForm(t)
  const [selectedRoles, setSelectedRoles] = useState<SchoolRole[]>(
    ASSIGNABLE_ROLES.filter((role) => roles.includes(role))
  )
  const toggleRole = (role: SchoolRole, checked: boolean) =>
    setSelectedRoles((current) =>
      checked ? [...current, role] : current.filter((selected) => selected !== role)
    )

  const handleSubmit = onSubmit(() => changeSchoolMemberRolesAction(userId, selectedRoles), {
    successKey: 'memberRoleUpdated',
    onSuccess: () => router.refresh(),
  })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-graphite">{t('newRole')}</legend>
          {ASSIGNABLE_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm text-graphite">
              <input
                type="checkbox"
                className="rounded"
                checked={selectedRoles.includes(role)}
                onChange={(event) => toggleRole(role, event.target.checked)}
                disabled={isPending}
              />
              {tRoles(role)}
            </label>
          ))}
          {roles.includes('TEACHER') && (
            <label className="flex items-center gap-2 text-sm text-graphite-600">
              <input type="checkbox" className="rounded" checked disabled />
              {tRoles('TEACHER')}
            </label>
          )}
          <p className="text-xs text-graphite-600">{t('rolesHint')}</p>
        </fieldset>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} submitKey="confirm" />
    </form>
  )
}

export function RemoveSchoolMemberDialog({
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
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit(() => removeSchoolMemberAction(userId), {
    successKey: 'memberRemoved',
    onSuccess: () => {
      router.refresh()
      onRemoved()
    },
  })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('removeMemberWarning')}</p>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitKey="confirm"
        submitVariant="destructive"
      />
    </form>
  )
}
