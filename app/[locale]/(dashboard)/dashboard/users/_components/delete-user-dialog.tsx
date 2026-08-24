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
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
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
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [confirmation, setConfirmation] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await deleteUserAction({ id: user.id, confirmation })
      if (result === 'OK') {
        toast.success(t('userDeleted'))
        router.refresh()
        setOpen(false)
        onDeleted()
        return
      }
      toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('deleteWarning')}</p>
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
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
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
