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
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { inviteUserAction } from '../../../_lib/invitation-actions'

type Family = { id: string; name: string }

export function InviteUserDialog({ families }: { families: Family[] }) {
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
        <InviteForm families={families} />
      </DialogContent>
    </Dialog>
  )
}

function InviteForm({ families }: { families: Family[] }) {
  const t = useTranslations('dashboard.pages.users.invite')
  const tRoles = useTranslations('roles')
  const locale = useLocale()
  const router = useRouter()
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useState('PARENT')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await inviteUserAction({
        email: formData.get('email') as string,
        role: formData.get('role') as string,
        locale: formData.get('locale') as string,
        familyId: (formData.get('familyId') as string) || undefined,
      })
      if (result === 'OK') {
        toast.success(t('success', { email: formData.get('email') as string }))
        setOpen(false)
        router.refresh()
      } else if (result === 'emailAlreadyUsed') {
        toast.error(t('emailAlreadyUsed'))
      } else {
        toastActionError(t, result)
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
              placeholder={t('emailPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">{t('role')}</Label>
            <select
              id="invite-role"
              name="role"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isPending}
              className="flex h-10 w-full rounded border border-gray-300 bg-transparent px-3 py-2 text-sm"
            >
              <option value="PARENT">{tRoles('PARENT')}</option>
              <option value="ADMIN">{tRoles('ADMIN')}</option>
            </select>
          </div>
          {role === 'PARENT' && families.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="invite-family">{t('family')}</Label>
              <select
                id="invite-family"
                name="familyId"
                defaultValue=""
                disabled={isPending}
                className="flex h-10 w-full rounded border border-gray-300 bg-transparent px-3 py-2 text-sm"
              >
                <option value="">{t('noFamily')}</option>
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">{t('familyHint')}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="invite-locale">{t('language')}</Label>
            <select
              id="invite-locale"
              name="locale"
              defaultValue={locale}
              disabled={isPending}
              className="flex h-10 w-full rounded border border-gray-300 bg-transparent px-3 py-2 text-sm"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
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
