'use client'

import type { User } from '@prisma/client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
import { Label } from '@/components/ui/input/input'
import { toast } from '@/lib/toast'
import type { Role } from '@/types/enums'
import { changeUserRoleAction, deactivateUserAction } from '../../../_lib/user-actions'

interface ActionCellProps {
  user: User
}

export function ActionCell({ user }: ActionCellProps) {
  const t = useTranslations('dashboard.pages.users')
  const [isPending, setIsPending] = useState(false)

  const handleChangeRole = async (newRole: Role) => {
    setIsPending(true)
    const result = await changeUserRoleAction({ userId: user.id, newRole })
    setIsPending(false)

    if (result === 'OK') {
      toast.success(t('roleChanged'))
    } else {
      toast.error(t('error'))
    }
  }

  const handleDeactivate = async () => {
    setIsPending(true)
    const result = await deactivateUserAction({ userId: user.id })
    setIsPending(false)

    if (result === 'OK') {
      toast.success(t('userDeactivated'))
    } else {
      toast.error(t('error'))
    }
  }

  return (
    <div className="flex gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            {t('changeRole')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('changeRole')}</DialogTitle>
          </DialogHeader>
          <ChangeRoleForm user={user} onSubmit={handleChangeRole} isPending={isPending} />
        </DialogContent>
      </Dialog>

      <Button
        variant="destructive"
        size="sm"
        disabled={isPending || !user.isActive}
        onClick={handleDeactivate}
      >
        {t('deactivate')}
      </Button>
    </div>
  )
}

function ChangeRoleForm({
  user,
  onSubmit,
  isPending,
}: {
  user: User
  onSubmit: (role: Role) => Promise<void>
  isPending: boolean
}) {
  const t = useTranslations('dashboard.pages.users')
  const tRoles = useTranslations('roles')
  const { setOpen } = useDialog()
  const [selectedRole, setSelectedRole] = useState<Role>(user.role as Role)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(selectedRole)
    setOpen(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-select">{t('newRole')}</Label>
            <select
              id="role-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as Role)}
              disabled={isPending}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
            >
              <option value="SUPER_ADMIN">{tRoles('SUPER_ADMIN')}</option>
              <option value="ADMIN">{tRoles('ADMIN')}</option>
              <option value="PARENT">{tRoles('PARENT')}</option>
            </select>
          </div>
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
