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
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { deactivateFamilyAction } from '../../../_lib/family-actions'

export function DeactivateFamilyButton({ familyId }: { familyId: string }) {
  const t = useTranslations('dashboard.pages.families.deactivate')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="destructive" size="sm">
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <DeactivateForm familyId={familyId} />
      </DialogContent>
    </Dialog>
  )
}

function DeactivateForm({ familyId }: { familyId: string }) {
  const t = useTranslations('dashboard.pages.families.deactivate')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await deactivateFamilyAction(familyId)
      if (result !== 'OK') {
        toast.error(t('error'))
      } else {
        toast.success(t('success'))
        setOpen(false)
        router.push('/dashboard/families')
      }
    })
  }

  return (
    <form onSubmit={handleConfirm}>
      <DialogBody>
        <p className="text-sm text-gray-600">{t('description')}</p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? '...' : t('confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
