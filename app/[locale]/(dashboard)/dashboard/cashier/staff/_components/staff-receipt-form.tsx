'use client'

import { Button, cn, Input, Label } from '@peaklab/ui'
import { useRouter as useNextRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { amountForDays, type MealLedger, previewMealPayment } from '@/domain/meal-ledger'
import { useRouter } from '@/i18n/routing'
import { currencyFractionDigits, formatCurrency } from '@/lib/decimal'
import { toastActionError } from '@/lib/toast'
import type { CashierPaymentMethod } from '@/use-cases/receipts/schemas'
import { recordStaffReceiptAction } from '../../../../_lib/staff-actions'

type Props = {
  staffMemberId: string
  /** Tarif cantine du jour, `null` sans tarif en vigueur. */
  unitPrice: number | null
  served: string[]
  ledger: MealLedger
  paidThrough: string | null
  dueAmount: number
  daysPerWeek: number
  currency: string
  locale: string
}

const METHODS: CashierPaymentMethod[] = ['CASH', 'MOBILE_MONEY', 'TRANSFER', 'CHECK']

const toAmount = (value: string) => {
  const amount = Number(value.replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

/** Même garde que la caisse famille : un renvoi retrouve le reçu déjà émis. */
function idempotencyKey(staffMemberId: string) {
  const storageKey = `cashier-staff-receipt-key:${staffMemberId}`
  const existing = sessionStorage.getItem(storageKey)
  if (existing) return { key: existing, storageKey }
  const key = crypto.randomUUID()
  sessionStorage.setItem(storageKey, key)
  return { key, storageKey }
}

/** Encaisse la cantine d'un membre du personnel et ouvre le reçu. */
export function StaffReceiptForm({
  staffMemberId,
  unitPrice,
  served,
  ledger,
  paidThrough,
  dueAmount,
  daysPerWeek,
  currency,
  locale,
}: Props) {
  const t = useTranslations('dashboard.pages.cashier')
  const tStaff = useTranslations('dashboard.pages.cashier.staff')
  const tMethods = useTranslations('dashboard.pages.payments.record.methods')
  const tPlaceholders = useTranslations('dashboard.pages.payments.record.referencePlaceholders')
  const router = useRouter()
  const nextRouter = useNextRouter()
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState('')
  const [method, setMethod] = useState<CashierPaymentMethod>('CASH')
  const [reference, setReference] = useState('')

  const step = 1 / 10 ** currencyFractionDigits(currency)
  const money = (amount: number) => formatCurrency(amount, locale, currency)
  const formatDay = (day: string) =>
    new Date(`${day}T00:00:00.000Z`).toLocaleDateString(locale, { timeZone: 'UTC' })

  if (unitPrice === null) return <p className="text-sm text-amber-600">{t('errors.noPrice')}</p>

  const amount = toAmount(value)
  const preview =
    amount > 0 ? previewMealPayment({ served, ledger, amount, unitPrice, daysPerWeek }) : null
  const quick = [
    { key: 'week', days: daysPerWeek },
    { key: 'twoWeeks', days: daysPerWeek * 2 },
    { key: 'month', days: daysPerWeek * 4 },
  ].filter((option) => option.days > 0)

  const submit = () => {
    startTransition(async () => {
      const { key, storageKey } = idempotencyKey(staffMemberId)
      const result = await recordStaffReceiptAction({
        idempotencyKey: key,
        staffMemberId,
        service: 'CANTEEN',
        amount,
        expectedPaidThrough: paidThrough,
        method,
        reference: reference.trim() || undefined,
      })
      if (typeof result === 'string') {
        toastActionError(tStaff, result)
        if (result === 'idempotencyConflict') sessionStorage.removeItem(storageKey)
        if (result === 'staleState' || result === 'idempotencyConflict') nextRouter.refresh()
        return
      }
      sessionStorage.removeItem(storageKey)
      router.push(`/dashboard/cashier/receipts/${result.id}`)
    })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="staff-receipt-amount" className="text-sm font-semibold text-graphite">
          {tStaff('amount')}
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="staff-receipt-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step={step}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={isPending}
            className="w-36"
          />
          {quick.map((option) => (
            <Button
              key={option.key}
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setValue(String(amountForDays(option.days, unitPrice, ledger.credit)))}
            >
              {t(`quick.${option.key}`)}
            </Button>
          ))}
          {dueAmount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setValue(String(dueAmount))}
            >
              {t('quick.settle')}
            </Button>
          )}
        </div>
        <p className="text-xs text-graphite-600">{t('unitPrice', { amount: money(unitPrice) })}</p>
        {preview && (
          <div className="space-y-1 text-sm">
            <p className="text-graphite">
              {t('preview', {
                days: preview.daysAdded,
                date: preview.newPaidThrough ? formatDay(preview.newPaidThrough) : '—',
              })}
              {preview.remainder > 0 &&
                ` · ${t('remainder', { amount: money(preview.remainder) })}`}
            </p>
            {preview.warnings.map((warning) => (
              <p key={warning} className="text-xs text-amber-600">
                {t(`warnings.${warning}`)}
              </p>
            ))}
          </div>
        )}
      </div>

      <fieldset disabled={isPending} className="space-y-2">
        <legend className="mb-2 text-sm font-medium leading-none">{t('method')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {METHODS.map((option) => (
            <label
              key={option}
              className={cn(
                'flex cursor-pointer items-center justify-center rounded border p-3 text-xs font-medium transition-colors',
                method === option
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-alabaster-700 text-graphite-600 hover:border-alabaster hover:bg-alabaster-900'
              )}
            >
              <input
                type="radio"
                name="method"
                value={option}
                checked={method === option}
                onChange={() => setMethod(option)}
                className="sr-only"
              />
              {tMethods(option)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="staff-receipt-reference">{t('reference')}</Label>
        <Input
          id="staff-receipt-reference"
          maxLength={250}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder={tPlaceholders(method)}
          disabled={isPending}
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-alabaster-700 pt-4">
        <p className="text-lg font-semibold text-graphite">
          {t('total', { amount: money(amount) })}
        </p>
        <Button type="submit" disabled={isPending || amount <= 0}>
          {t('submit')}
        </Button>
      </div>
    </form>
  )
}
