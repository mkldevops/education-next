'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@/components/ui/dialog/dialog'
import { Input, Label } from '@/components/ui/input/input'
import { toast } from '@/lib/toast'
import { inviteUserAction } from '../../../_lib/invitation-actions'

export function InviteUserDialog() {
  const t = useTranslations('dashboard.pages.users.invite')

  return (
    <Dialog>
      <DialogTrigger>
        <Button>{t('button')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <InviteForm />
      </DialogContent>
    </Dialog>
  )
}

function InviteForm() {
  const t = useTranslations('dashboard.pages.users.invite')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await inviteUserAction({
        email: formData.get('email') as string,
        role: formData.get('role') as string,
      })
      if (result === 'OK') {
        toast.success(t('success', { email: formData.get('email') as string }))
        setOpen(false)
      } else if (result === 'emailAlreadyUsed') {
        toast.error(t('emailAlreadyUsed'))
      } else {
        toast.error(t('error'))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t('email')}</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              disabled={isPending}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">{t('role')}</Label>
            <select
              id="invite-role"
              name="role"
              required
              disabled={isPending}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
            >
              <option value="PARENT">Parent</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t('send')}
        </Button>
      </DialogFooter>
    </form>
  )
}
