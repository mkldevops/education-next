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
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { currencyStep, currencySymbol, formatCurrency } from '@/lib/decimal'
import { setEnrollmentStartMonthAction } from '../../../_lib/enrollment-actions'

export interface StartMonthSetting {
  /** `YYYY-MM`, or `null` when the enrollment owes from its period start. */
  value: string | null
  /** Months of the enrollment's period, `YYYY-MM`. */
  min?: string
  max?: string
  /** Reduced first installment currently set, `null` when the plan's own applies. */
  firstInstallmentAmount: number | null
  /** Only a monthly plan lets its first month be reduced. */
  monthlyPlan: boolean
}

interface SetStartMonthDialogProps {
  enrollmentId: string
  startMonth: StartMonthSetting
  discount: number
  currency: string
}

export function SetStartMonthDialog(props: SetStartMonthDialogProps) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.setStartMonth')

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
        <StartMonthForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function StartMonthForm({
  enrollmentId,
  startMonth,
  discount,
  currency,
}: SetStartMonthDialogProps) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.setStartMonth')
  const locale = useLocale()
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()
  const [month, setMonth] = useState(startMonth.value ?? '')
  const [firstAmount, setFirstAmount] = useState(
    startMonth.firstInstallmentAmount === null ? '' : String(startMonth.firstInstallmentAmount)
  )
  // A value already set stays editable — and removable — after its plan stopped being monthly.
  const canReduceFirstMonth = startMonth.monthlyPlan || startMonth.firstInstallmentAmount !== null

  // A reduced first month belongs to the month it was typed for: another month starts blank.
  const changeMonth = (value: string) => {
    setMonth(value)
    setFirstAmount('')
  }

  const handleSubmit = onSubmit(
    (formData) =>
      setEnrollmentStartMonthAction({
        enrollmentId,
        startMonth: month || null,
        firstInstallmentAmount:
          canReduceFirstMonth && month && firstAmount.trim() !== '' ? Number(firstAmount) : null,
        removeDiscount: formData.get('removeDiscount') === 'on',
      }),
    { onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="enrollment-start-month">{t('label')}</Label>
            <Input
              id="enrollment-start-month"
              name="startMonth"
              type="month"
              min={startMonth.min}
              max={startMonth.max}
              value={month}
              onChange={(event) => changeMonth(event.target.value)}
              disabled={isPending}
            />
            <p className="text-sm text-graphite-600">{t('hint')}</p>
          </div>

          {canReduceFirstMonth && (
            <div className="space-y-2">
              <Label htmlFor="enrollment-first-installment">
                {t('firstInstallment', { currency: currencySymbol(locale, currency) })}
              </Label>
              <Input
                id="enrollment-first-installment"
                name="firstInstallmentAmount"
                type="number"
                step={currencyStep(currency)}
                min={currencyStep(currency)}
                value={month ? firstAmount : ''}
                onChange={(event) => setFirstAmount(event.target.value)}
                aria-describedby="enrollment-first-installment-hint"
                disabled={isPending || !month}
              />
              <p id="enrollment-first-installment-hint" className="text-sm text-graphite-600">
                {t('firstInstallmentHint')}
              </p>
            </div>
          )}

          {discount > 0 && (
            <div className="space-y-2 rounded border border-alabaster-700 p-3 text-sm">
              <p className="text-graphite">
                {t('currentDiscount', { amount: formatCurrency(discount, locale, currency) })}
              </p>
              <p className="text-graphite-600">{t('discountHint')}</p>
              <label className="flex items-center gap-2 text-graphite">
                <input
                  type="checkbox"
                  name="removeDiscount"
                  className="size-4 accent-primary"
                  disabled={isPending}
                />
                {t('removeDiscount')}
              </label>
            </div>
          )}
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
