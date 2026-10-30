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
import { useState } from 'react'
import { readPaymentSchedule, readPlanPricing } from '@/domain/payment-schedule'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { deactivatePlanAction, updatePlanAction } from '../../../_lib/plan-actions'
import { type PlanConfiguration, PlanConfigurationFields } from './plan-configuration-fields'

interface EditPlanDialogProps {
  plan: {
    id: string
    name: string
    amount: number
    pricing?: unknown
    paymentSchedule?: unknown
  }
  openEnrollments: number
  currency: string
}

export function EditPlanDialog(props: EditPlanDialogProps) {
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
        <EditPlanForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function EditPlanForm({ plan, openEnrollments, currency }: EditPlanDialogProps) {
  const t = useTranslations('dashboard.pages.plans.edit')
  const tCreate = useTranslations('dashboard.pages.plans.create')
  const [configuration, setConfiguration] = useState<PlanConfiguration>({
    pricing: readPlanPricing(plan.pricing, plan.amount),
    paymentSchedule: readPaymentSchedule(plan.paymentSchedule),
  })
  const { isPending, close, run, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    updatePlanAction(plan.id, {
      name: formData.get('name') as string,
      ...configuration,
    })
  )

  const handleArchive = () =>
    run(() => deactivatePlanAction(plan.id), { successKey: 'archiveSuccess' })

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
          <PlanConfigurationFields
            value={configuration}
            onChange={setConfiguration}
            currency={currency}
            disabled={isPending}
          />
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close}>
        <Button
          type="button"
          variant="destructive"
          className="mr-auto"
          onClick={handleArchive}
          disabled={isPending || openEnrollments > 0}
          title={openEnrollments > 0 ? t('errors.planInUse') : undefined}
        >
          {t('archive')}
        </Button>
      </DialogFormActions>
    </form>
  )
}
