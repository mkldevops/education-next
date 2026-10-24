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
import type { MealService } from '@/generated/prisma/enums'
import { currencyStep, currencySymbol } from '@/lib/decimal'
import { setMealPriceAction } from '../../../_lib/meal-actions'

type Props = {
  service: MealService
  currency: string
  /** Aujourd'hui dans le fuseau de l'école, `YYYY-MM-DD`. */
  today: string
  /** Sans tarif, la date peut remonter au début de l'année. */
  hasPrice: boolean
}

export function AddMealPriceDialog(props: Props) {
  const t = useTranslations('dashboard.pages.meals.addPrice')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <AddMealPriceForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function AddMealPriceForm({ service, currency, today, hasPrice }: Props) {
  const t = useTranslations('dashboard.pages.meals.addPrice')
  const locale = useLocale()
  const step = currencyStep(currency)
  const { isPending, close, onSubmit } = useDialogForm(t)
  const amountId = `meal-price-amount-${service}`
  const dateId = `meal-price-date-${service}`

  const handleSubmit = onSubmit((formData) =>
    setMealPriceAction({
      service,
      amount: Number(formData.get('amount')),
      effectiveFrom: formData.get('effectiveFrom') as string,
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={amountId}>
              {t('amount', { currency: currencySymbol(locale, currency) })}
            </Label>
            <Input
              id={amountId}
              name="amount"
              type="number"
              step={step}
              min={step}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={dateId}>{t('effectiveFrom')}</Label>
            <Input
              id={dateId}
              name="effectiveFrom"
              type="date"
              defaultValue={today}
              min={hasPrice ? today : undefined}
              required
              disabled={isPending}
            />
            <p className="text-xs text-graphite-600">
              {hasPrice ? t('effectiveFromHint') : t('firstPriceHint')}
            </p>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
