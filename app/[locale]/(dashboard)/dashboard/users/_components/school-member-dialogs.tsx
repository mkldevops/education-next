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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  const roleItems: Array<{ value: SchoolRole; label: string }> = [
    { value: 'ADMIN', label: tRoles('ADMIN') },
    { value: 'PARENT', label: tRoles('PARENT') },
  ]
  const [selectedRole, setSelectedRole] = useState<SchoolRole>(
    roleItems.some((item) => item.value === role) ? role : 'ADMIN'
  )

  const handleSubmit = onSubmit(() => changeSchoolMemberRoleAction(userId, selectedRole), {
    successKey: 'memberRoleUpdated',
    onSuccess: () => router.refresh(),
  })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-2">
          <Label htmlFor="school-member-role">{t('newRole')}</Label>
          <Select
            items={roleItems}
            value={selectedRole}
            onValueChange={(value) => value !== null && setSelectedRole(value)}
            disabled={isPending}
          >
            <SelectTrigger id="school-member-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
