'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@peaklab/ui'
import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { setStaffMealExemptAction } from '../../../../_lib/staff-actions'

type Props = { member: { id: string; mealExempt: boolean } }

/** Exonère un enseignant de la cantine, ou lève l'exonération. */
export function StaffExemptDialog({ member }: Props) {
  const t = useTranslations('dashboard.pages.cashier.staff.dialog')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" />
          {t('editTitle')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <StaffExemptForm member={member} />
      </DialogContent>
    </Dialog>
  )
}

function StaffExemptForm({ member }: Props) {
  const t = useTranslations('dashboard.pages.cashier.staff.dialog')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    setStaffMealExemptAction({ id: member.id, mealExempt: formData.get('mealExempt') === 'on' })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <label className="flex items-start gap-2 text-sm text-graphite">
          <input
            type="checkbox"
            name="mealExempt"
            defaultChecked={member.mealExempt}
            className="mt-0.5 rounded"
            disabled={isPending}
          />
          <span>
            {t('mealExempt')}
            <span className="block text-xs text-graphite-600">{t('mealExemptHint')}</span>
          </span>
        </label>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
