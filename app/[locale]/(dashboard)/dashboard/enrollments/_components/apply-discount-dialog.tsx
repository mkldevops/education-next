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
import { calculateRemainingBalance } from '@/domain/enrollment'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { currencyStep, currencySymbol, formatCurrency, roundHalfUp } from '@/lib/decimal'
import { applyDiscountAction } from '../../../_lib/enrollment-actions'

interface ApplyDiscountDialogProps {
  enrollmentId: string
  currentTotalAmount: number
  currentDiscount: number
  totalPaid: number
  currency: string
}

export function ApplyDiscountDialog(props: ApplyDiscountDialogProps) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.applyDiscount')

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
        <DiscountForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function DiscountForm({
  enrollmentId,
  currentTotalAmount,
  currentDiscount,
  totalPaid,
  currency,
}: ApplyDiscountDialogProps) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.applyDiscount')
  const locale = useLocale()
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()
  const planAmount = roundHalfUp(currentTotalAmount + currentDiscount)
  const [value, setValue] = useState(String(currentTotalAmount))

  const entered = value.trim() === '' ? Number.NaN : Number(value)
  const isValid = Number.isFinite(entered) && entered >= 0 && entered <= planAmount
  const isUnchanged = isValid && entered === currentTotalAmount
  const isBelowPaid = isValid && entered < totalPaid
  const money = (amount: number) => formatCurrency(amount, locale, currency)

  const handleSubmit = onSubmit(() => applyDiscountAction({ enrollmentId, totalAmount: entered }), {
    onSuccess: () => router.refresh(),
  })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="discount-amount">
              {t('totalAmount', { currency: currencySymbol(locale, currency) })}
            </Label>
            <div className="flex gap-2">
              <Input
                id="discount-amount"
                name="totalAmount"
                type="number"
                step={currencyStep(currency)}
                min="0"
                max={planAmount}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-describedby="discount-amount-hint"
                required
                disabled={isPending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setValue('0')}
                disabled={isPending}
              >
                {t('free')}
              </Button>
            </div>
            <p id="discount-amount-hint" className="text-xs text-graphite-600">
              {t('hint')}
            </p>
          </div>

          {isValid && (
            <dl className="space-y-1 rounded border border-alabaster-700 p-3 text-sm">
              <SummaryRow label={t('summary.planAmount')} value={money(planAmount)} />
              <SummaryRow
                label={t('summary.discount')}
                value={money(-roundHalfUp(planAmount - entered))}
              />
              {totalPaid > 0 && (
                <SummaryRow label={t('summary.totalPaid')} value={money(totalPaid)} />
              )}
              {!isBelowPaid && (
                <SummaryRow
                  label={t('summary.remaining')}
                  value={money(calculateRemainingBalance(entered, totalPaid))}
                  strong
                />
              )}
            </dl>
          )}

          {isBelowPaid && (
            <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-800">
              {t('belowPaid', { paid: money(totalPaid) })}
            </p>
          )}
        </div>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitDisabled={!isValid || isUnchanged || isBelowPaid}
      />
    </form>
  )
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong ? 'flex justify-between border-t pt-1 font-semibold' : 'flex justify-between'
      }
    >
      <dt className="text-graphite-600">{label}</dt>
      <dd className="text-graphite">{value}</dd>
    </div>
  )
}
