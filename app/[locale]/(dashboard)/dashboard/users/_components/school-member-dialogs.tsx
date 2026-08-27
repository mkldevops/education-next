'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import type { SchoolRole } from '@/types/enums'
import { changeSchoolMemberRoleAction, removeSchoolMemberAction } from '../../../_lib/user-actions'

export function ChangeSchoolMemberRoleDialog({
  userId,
  role,
}: {
  userId: string
  role: SchoolRole
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
        <ChangeSchoolMemberRoleForm key={role} userId={userId} role={role} />
      </DialogContent>
    </Dialog>
  )
}

function ChangeSchoolMemberRoleForm({ userId, role }: { userId: string; role: SchoolRole }) {
  const t = useTranslations('dashboard.pages.users')
  const tRoles = useTranslations('roles')
  const router = useRouter()
  const { isPending, close, onSubmit } = useDialogForm(t)
  const [selectedRole, setSelectedRole] = useState(role)

  const handleSubmit = onSubmit(() => changeSchoolMemberRoleAction(userId, selectedRole), {
    successKey: 'memberRoleUpdated',
    onSuccess: () => router.refresh(),
  })

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
        <p className="text-sm text-gray-600">{t('removeMemberWarning')}</p>
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
