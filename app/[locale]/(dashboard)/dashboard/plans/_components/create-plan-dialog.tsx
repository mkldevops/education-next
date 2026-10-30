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
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { createPlanAction } from '../../../_lib/plan-actions'
import { type PlanConfiguration, PlanConfigurationFields } from './plan-configuration-fields'

export function CreatePlanDialog({ currency }: { currency: string }) {
  const t = useTranslations('dashboard.pages.plans.create')

  return (
    <Dialog>
      <DialogTrigger>
        <Button>
          <Plus className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreatePlanForm currency={currency} />
      </DialogContent>
    </Dialog>
  )
}

function CreatePlanForm({ currency }: { currency: string }) {
  const t = useTranslations('dashboard.pages.plans.create')
  const [configuration, setConfiguration] = useState<PlanConfiguration>({
    pricing: { mode: 'ANNUAL', amount: 0 },
    paymentSchedule: { mode: 'NONE' },
  })
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    createPlanAction({
      name: formData.get('name') as string,
      ...configuration,
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">{t('name')}</Label>
            <Input id="plan-name" name="name" required maxLength={50} disabled={isPending} />
          </div>
          <PlanConfigurationFields
            value={configuration}
            onChange={setConfiguration}
            currency={currency}
            disabled={isPending}
          />
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
