'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { updatePlanAction } from '../../../_lib/plan-actions'

interface EditPlanDialogProps {
  plan: {
    id: string
    name: string
    amount: number
  }
}

export function EditPlanDialog({ plan }: EditPlanDialogProps) {
  const t = useTranslations('dashboard.pages.plans.edit')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditPlanForm plan={plan} />
      </DialogContent>
    </Dialog>
  )
}

function EditPlanForm({ plan }: EditPlanDialogProps) {
  const t = useTranslations('dashboard.pages.plans.edit')
  const tCreate = useTranslations('dashboard.pages.plans.create')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    updatePlanAction(plan.id, {
      name: formData.get('name') as string,
      amount: Number(formData.get('amount')),
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-plan-name">{tCreate('name')}</Label>
            <Input
              id="edit-plan-name"
              name="name"
              defaultValue={plan.name}
              required
              maxLength={50}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-plan-amount">{tCreate('amount')}</Label>
            <Input
              id="edit-plan-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={plan.amount}
              required
              disabled={isPending}
            />
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
