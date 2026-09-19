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
  Input,
  Label,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { deleteUserAction } from '../../../_lib/user-actions'
import type { MemberRow } from './users-table'

interface Props {
  user: MemberRow['user']
  onDeleted: () => void
}

export function DeleteUserDialog({ user, onDeleted }: Props) {
  const t = useTranslations('dashboard.pages.users')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="destructive" size="sm">
          {t('delete')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
        </DialogHeader>
        <DeleteUserForm user={user} onDeleted={onDeleted} />
      </DialogContent>
    </Dialog>
  )
}

function DeleteUserForm({ user, onDeleted }: Props) {
  const t = useTranslations('dashboard.pages.users')
  const router = useRouter()
  const { isPending, close, onSubmit } = useDialogForm(t)
  const [confirmation, setConfirmation] = useState('')

  const handleSubmit = onSubmit(() => deleteUserAction({ id: user.id, confirmation }), {
    successKey: 'userDeleted',
    onSuccess: () => {
      router.refresh()
      onDeleted()
    },
  })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <p className="text-sm text-graphite-600">{t('deleteWarning')}</p>
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">
              {t('deleteConfirmationLabel', { email: user.email })}
            </Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={isPending}
              autoComplete="off"
              required
            />
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={close} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={isPending || confirmation.trim().toLowerCase() !== user.email.toLowerCase()}
        >
          {isPending ? '...' : t('delete')}
        </Button>
      </DialogFooter>
    </form>
  )
}
