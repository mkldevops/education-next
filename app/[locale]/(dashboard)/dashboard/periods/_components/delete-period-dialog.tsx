'use client'

import {
  Button,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { deactivatePeriodAction } from '../../../_lib/period-actions'

type Props = {
  period: { id: string; name: string }
}

/**
 * La fermeture précède le rafraîchissement, contrairement à `useDialogForm` : la
 * suppression retire la ligne qui porte ce dialogue, donc un `startTransition` qui
 * englobe le nouveau rendu serveur laisserait le panneau figé sur son état « en cours »
 * jusqu'à son propre démontage.
 */
export function DeletePeriodDialogContent({ period }: Props) {
  const t = useTranslations('dashboard.pages.periods.delete')
  const { setOpen } = useDialog()
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const confirm = async () => {
    setPending(true)
    try {
      const result = await deactivatePeriodAction({ id: period.id })
      if (result !== 'OK') {
        toastActionError(t, result)
        setPending(false)
        return
      }
      setOpen(false)
      toast.success(t('success'))
      router.refresh()
    } catch {
      toast.error(t('error'))
      setPending(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('description', { name: period.name })}</p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
          {pending ? '...' : t('confirm')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
