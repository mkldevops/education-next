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
import type { Role } from '@/types/enums'
import { changeUserRoleAction, updateUserAction } from '../../../_lib/user-actions'
import type { UserRow } from './users-table'

const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'PARENT']

interface Props {
  user: UserRow
  isSelf: boolean
}

export function EditUserDialog({ user, isSelf }: Props) {
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
        <EditUserForm user={user} isSelf={isSelf} />
      </DialogContent>
    </Dialog>
  )
}

function EditUserForm({ user, isSelf }: Props) {
  const t = useTranslations('dashboard.pages.users')
  const tRoles = useTranslations('roles')
  const router = useRouter()
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(user.name ?? '')
  const [email, setEmail] = useState(user.email)
  const [emailVerified, setEmailVerified] = useState(user.emailVerified)
  const [role, setRole] = useState<Role>(user.role)

  const fail = (result: string) => {
    toast.error(t.has(`errors.${result}`) ? t(`errors.${result}`) : t('error'))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const updated = await updateUserAction({
        id: user.id,
        name: name.trim() === '' ? null : name.trim(),
        email: email.trim(),
        emailVerified,
      })
      if (updated !== 'OK') {
        fail(updated)
        return
      }

      if (role !== user.role) {
        const roleResult = await changeUserRoleAction({ id: user.id, role })
        if (roleResult !== 'OK') {
          fail(roleResult)
          router.refresh()
          return
        }
      }

      toast.success(t('userUpdated'))
      router.refresh()
      setOpen(false)
    })
  }

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
          <div className="space-y-2">
            <Label htmlFor="user-role">{t('newRole')}</Label>
            <select
              id="user-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={isPending || isSelf}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
            >
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {tRoles(value)}
                </option>
              ))}
            </select>
            {isSelf && <p className="text-xs text-gray-500">{t('cannotChangeOwnRole')}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={emailVerified}
              onChange={(e) => setEmailVerified(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t('emailVerified')}
          </label>
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
