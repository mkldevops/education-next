'use client'

import { Button, cn, Input, Label } from '@peaklab/ui'
import { useRouter as useNextRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { formatChildcareMonth } from '@/domain/childcare'
import { amountForDays, type MealLedger, previewMealPayment } from '@/domain/meal-ledger'
import { receiptTotal } from '@/domain/receipt'
import { useRouter } from '@/i18n/routing'
import { currencyFractionDigits, formatCurrency } from '@/lib/decimal'
import { toastActionError } from '@/lib/toast'
import type { CashierPaymentMethod } from '@/use-cases/receipts/schemas'
import { recordReceiptAction } from '../../../_lib/receipt-actions'

export type CashierLine = {
  studentId: string
  name: string
  service: 'CANTEEN' | 'SNACK'
  /** Tarif du jour, `null` quand le service n'a pas encore de tarif. */
  unitPrice: number | null
  served: string[]
  ledger: MealLedger
  paidThrough: string | null
  dueAmount: number
  dueDays: number
  daysPerWeek: number
}

export type CashierChildcareLine = {
  chargeId: string
  name: string
  month: string
  remaining: number
}

type Props = {
  familyId: string
  lines: CashierLine[]
  childcare: CashierChildcareLine[]
  /** Écolage restant dû, `null` quand l'école n'encaisse pas l'écolage. */
  tuitionDue: number | null
  currency: string
  locale: string
}

const METHODS: CashierPaymentMethod[] = ['CASH', 'MOBILE_MONEY', 'TRANSFER', 'CHECK']

const lineKey = (line: Pick<CashierLine, 'studentId' | 'service'>) =>
  `${line.studentId}:${line.service}`

const toAmount = (value: string | undefined) => {
  const amount = Number((value ?? '').replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

/**
 * Clé d'idempotence d'un encaissement en cours. Gardée dans la session de l'onglet : un
 * renvoi après une coupure réseau retrouve le reçu déjà émis au lieu d'en créer un second.
 */
function idempotencyKey(familyId: string) {
  const storageKey = `cashier-receipt-key:${familyId}`
  const existing = sessionStorage.getItem(storageKey)
  if (existing) return { key: existing, storageKey }
  const key = crypto.randomUUID()
  sessionStorage.setItem(storageKey, key)
  return { key, storageKey }
}

export function CashierForm({ familyId, lines, childcare, tuitionDue, currency, locale }: Props) {
  const t = useTranslations('dashboard.pages.cashier')
  const tServices = useTranslations('dashboard.pages.meals.services')
  const tMethods = useTranslations('dashboard.pages.payments.record.methods')
  const tPlaceholders = useTranslations('dashboard.pages.payments.record.referencePlaceholders')
  const router = useRouter()
  const nextRouter = useNextRouter()
  const [isPending, startTransition] = useTransition()
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [childcareAmounts, setChildcareAmounts] = useState<Record<string, string>>({})
  const [tuition, setTuition] = useState('')
  const [method, setMethod] = useState<CashierPaymentMethod>('CASH')
  const [reference, setReference] = useState('')

  const step = 1 / 10 ** currencyFractionDigits(currency)
  const money = (value: number) => formatCurrency(value, locale, currency)
  const formatDay = (day: string) =>
    new Date(`${day}T00:00:00.000Z`).toLocaleDateString(locale, { timeZone: 'UTC' })

  const meals = lines.flatMap((line) => {
    const amount = toAmount(amounts[lineKey(line)])
    return amount > 0 && line.unitPrice !== null
      ? [
          {
            studentId: line.studentId,
            service: line.service,
            amount,
            expectedPaidThrough: line.paidThrough,
          },
        ]
      : []
  })
  const tuitionAmount = tuitionDue === null ? 0 : toAmount(tuition)
  const childcareLines = childcare.flatMap((line) => {
    const amount = toAmount(childcareAmounts[line.chargeId])
    return amount > 0 ? [{ chargeId: line.chargeId, amount }] : []
  })
  const total = receiptTotal({ tuition: tuitionAmount, meals, childcare: childcareLines })

  const setAmount = (line: CashierLine, value: number) =>
    setAmounts((current) => ({ ...current, [lineKey(line)]: String(value) }))

  const submit = () => {
    startTransition(async () => {
      const { key, storageKey } = idempotencyKey(familyId)
      const result = await recordReceiptAction({
        idempotencyKey: key,
        familyId,
        method,
        reference: reference.trim() || undefined,
        tuition: tuitionAmount,
        meals,
        childcare: childcareLines,
      })
      if (typeof result === 'string') {
        toastActionError(t, result)
        // Rien n'a été écrit : la clé reste valable pour un contenu corrigé. Un conflit dit
        // qu'un reçu est déjà sorti sous cette clé : la caisse repart d'une clé neuve.
        if (result === 'idempotencyConflict') sessionStorage.removeItem(storageKey)
        if (
          result === 'staleState' ||
          result === 'idempotencyConflict' ||
          result === 'childcareOverpayment'
        ) {
          nextRouter.refresh()
        }
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
      {lines.length === 0 && childcare.length === 0 && (
        <p className="text-sm text-graphite-600">{t('noLines')}</p>
      )}
      {lines.length > 0 && (
        <ul className="divide-y divide-alabaster-700">
          {lines.map((line) => {
            const amount = toAmount(amounts[lineKey(line)])
            const preview =
              amount > 0 && line.unitPrice !== null
                ? previewMealPayment({
                    served: line.served,
                    ledger: line.ledger,
                    amount,
                    unitPrice: line.unitPrice,
                    daysPerWeek: line.daysPerWeek,
                  })
                : null
            const id = `cashier-${lineKey(line)}`
            const unitPrice = line.unitPrice
            const quick =
              unitPrice === null
                ? []
                : [
                    { key: 'week', days: line.daysPerWeek },
                    { key: 'twoWeeks', days: line.daysPerWeek * 2 },
                    { key: 'month', days: line.daysPerWeek * 4 },
                  ].filter((option) => option.days > 0)

            return (
              <li key={lineKey(line)} className="space-y-2 py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Label htmlFor={id} className="text-sm font-semibold text-graphite">
                    {line.name} · {tServices(line.service)}
                  </Label>
                  <span className="text-xs text-graphite-600">
                    {line.paidThrough
                      ? t('paidThrough', { date: formatDay(line.paidThrough) })
                      : t('nothingPaid')}
                    {line.dueDays > 0 &&
                      ` · ${t('due', { days: line.dueDays, amount: money(line.dueAmount) })}`}
                  </span>
                </div>
                {unitPrice === null ? (
                  <p className="text-sm text-amber-600">{t('errors.noPrice')}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id={id}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={step}
                        value={amounts[lineKey(line)] ?? ''}
                        onChange={(event) =>
                          setAmounts((current) => ({
                            ...current,
                            [lineKey(line)]: event.target.value,
                          }))
                        }
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
                          onClick={() =>
                            setAmount(
                              line,
                              amountForDays(option.days, unitPrice, line.ledger.credit)
                            )
                          }
                        >
                          {t(`quick.${option.key}`)}
                        </Button>
                      ))}
                      {line.dueAmount > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => setAmount(line, line.dueAmount)}
                        >
                          {t('quick.settle')}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-graphite-600">
                      {t('unitPrice', { amount: money(unitPrice) })}
                    </p>
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
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {childcare.length > 0 && (
        <ul className="divide-y divide-alabaster-700">
          {childcare.map((line) => {
            const id = `cashier-childcare-${line.chargeId}`
            return (
              <li key={line.chargeId} className="space-y-2 py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Label htmlFor={id} className="text-sm font-semibold text-graphite">
                    {line.name} · {t('childcare')}
                  </Label>
                  <span className="text-xs text-graphite-600">
                    {formatChildcareMonth(line.month, locale)} ·{' '}
                    {t('childcareDue', { amount: money(line.remaining) })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={line.remaining}
                    step={step}
                    value={childcareAmounts[line.chargeId] ?? ''}
                    onChange={(event) =>
                      setChildcareAmounts((current) => ({
                        ...current,
                        [line.chargeId]: event.target.value,
                      }))
                    }
                    disabled={isPending}
                    className="w-36"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      setChildcareAmounts((current) => ({
                        ...current,
                        [line.chargeId]: String(line.remaining),
                      }))
                    }
                  >
                    {t('quick.settle')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {tuitionDue !== null && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Label htmlFor="cashier-tuition" className="text-sm font-semibold text-graphite">
              {t('tuition')}
            </Label>
            <span className="text-xs text-graphite-600">
              {t('tuitionDue', { amount: money(tuitionDue) })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="cashier-tuition"
              type="number"
              inputMode="decimal"
              min={0}
              max={tuitionDue}
              step={step}
              value={tuition}
              onChange={(event) => setTuition(event.target.value)}
              disabled={isPending || tuitionDue <= 0}
              className="w-36"
            />
            {tuitionDue > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setTuition(String(tuitionDue))}
              >
                {t('quick.settle')}
              </Button>
            )}
          </div>
        </div>
      )}

      <fieldset disabled={isPending} className="space-y-2">
        <legend className="mb-2 text-sm font-medium leading-none">{t('method')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {METHODS.map((value) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-center justify-center rounded border p-3 text-xs font-medium transition-colors',
                method === value
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-alabaster-700 text-graphite-600 hover:border-alabaster hover:bg-alabaster-900'
              )}
            >
              <input
                type="radio"
                name="method"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
                className="sr-only"
              />
              {tMethods(value)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="cashier-reference">{t('reference')}</Label>
        <Input
          id="cashier-reference"
          maxLength={250}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder={tPlaceholders(method)}
          disabled={isPending}
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-alabaster-700 pt-4">
        <p className="text-lg font-semibold text-graphite">
          {t('total', { amount: money(total) })}
        </p>
        <Button type="submit" disabled={isPending || total <= 0}>
          {t('submit')}
        </Button>
      </div>
    </form>
  )
}
