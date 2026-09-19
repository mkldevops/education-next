'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { updateUserAction } from '../../../_lib/user-actions'
import type { MemberRow } from './users-table'

interface Props {
  user: MemberRow['user']
}

export function EditUserDialog({ user }: Props) {
  const t = useTranslations('dashboard.pages.users')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('edit')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <EditUserForm user={user} />
      </DialogContent>
    </Dialog>
  )
}

function EditUserForm({ user }: Props) {
  const t = useTranslations('dashboard.pages.users')
  const router = useRouter()
  const { isPending, close, onSubmit } = useDialogForm(t)
  const [name, setName] = useState(user.name ?? '')
  const [email, setEmail] = useState(user.email)
  const [emailVerified, setEmailVerified] = useState(user.emailVerified)

  const handleSubmit = onSubmit(
    () =>
      updateUserAction({
        id: user.id,
        name: name.trim() === '' ? null : name.trim(),
        email: email.trim(),
        emailVerified,
      }),
    { successKey: 'userUpdated', onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">{t('name')}</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              maxLength={250}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">{t('email')}</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              required
              maxLength={250}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-graphite">
            <input
              type="checkbox"
              checked={emailVerified}
              onChange={(e) => setEmailVerified(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded border-alabaster"
            />
            {t('emailVerified')}
          </label>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} submitKey="confirm" />
    </form>
  )
}
