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
  Label,
  Select,
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { linkUserFamilyAction } from '../../../_lib/user-actions'

interface Props {
  userId: string
  families: Array<{ id: string; name: string }>
}

export function LinkFamilyDialog({ userId, families }: Props) {
  const t = useTranslations('dashboard.pages.users')

  if (families.length === 0) return null

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('linkFamily')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('linkFamily')}</DialogTitle>
        </DialogHeader>
        <LinkFamilyForm userId={userId} families={families} />
      </DialogContent>
    </Dialog>
  )
}

function LinkFamilyForm({ userId, families }: Props) {
  const t = useTranslations('dashboard.pages.users')
  const router = useRouter()
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await linkUserFamilyAction({ id: userId, familyId })
      if (result === 'OK') {
        toast.success(t('familyLinked'))
        router.refresh()
        setOpen(false)
        return
      }
      toastActionError(t, result)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-2">
          <Label htmlFor="link-family">{t('family')}</Label>
          <Select
            id="link-family"
            value={familyId}
            onChange={(e) => setFamilyId(e.target.value)}
            disabled={isPending}
          >
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.name}
              </option>
            ))}
          </Select>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending || !familyId}>
          {isPending ? '...' : t('confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
