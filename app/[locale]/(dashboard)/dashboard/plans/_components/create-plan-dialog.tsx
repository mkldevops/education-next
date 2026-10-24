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
import { useLocale, useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { currencyStep, currencySymbol } from '@/lib/decimal'
import { createPlanAction } from '../../../_lib/plan-actions'

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
  const locale = useLocale()
  const step = currencyStep(currency)
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    createPlanAction({
      name: formData.get('name') as string,
      amount: Number(formData.get('amount')),
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
          <div className="space-y-2">
            <Label htmlFor="plan-amount">
              {t('amount', { currency: currencySymbol(locale, currency) })}
            </Label>
            <Input
              id="plan-amount"
              name="amount"
              type="number"
              step={step}
              min={step}
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
