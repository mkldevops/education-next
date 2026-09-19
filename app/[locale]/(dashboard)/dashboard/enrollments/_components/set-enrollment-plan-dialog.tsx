'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { DialogFormActions } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { toastActionError } from '@/lib/toast'
import { setEnrollmentPlanAction } from '../../../_lib/enrollment-actions'

interface Option {
  id: string
  name: string
}

interface SetEnrollmentPlanDialogProps {
  enrollmentId: string
  plans: Option[]
}

/**
 * Affecte une formule à une inscription encore rattachée à la ligne réservée « sans tarif »
 * (FR-020). Pas de champ de remise : la remise de l'inscription reste celle qu'elle porte
 * déjà, `setEnrollmentPlan` la conserve sans qu'on la redemande ici.
 */
export function SetEnrollmentPlanDialog({ enrollmentId, plans }: SetEnrollmentPlanDialogProps) {
  const t = useTranslations('dashboard.pages.enrollments.setPlan')

  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm">{t('title')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <SetPlanForm enrollmentId={enrollmentId} plans={plans} />
      </DialogContent>
    </Dialog>
  )
}

function SetPlanForm({ enrollmentId, plans }: SetEnrollmentPlanDialogProps) {
  const t = useTranslations('dashboard.pages.enrollments.setPlan')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await setEnrollmentPlanAction({
        enrollmentId,
        planId: formData.get('planId') as string,
      })
      if (result !== 'OK') {
        toastActionError(t, result)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-2">
          <Label htmlFor="set-plan-select">{t('selectPlan')}</Label>
          <Select id="set-plan-select" name="planId" required disabled={isPending}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={() => setOpen(false)} />
    </form>
  )
}
