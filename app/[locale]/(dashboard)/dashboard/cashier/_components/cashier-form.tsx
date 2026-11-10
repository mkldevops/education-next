'use client'

import { Button, cn, Input, Label } from '@peaklab/ui'
import { useRouter as useNextRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type ReactNode, useState, useTransition } from 'react'
import { formatChildcareMonth } from '@/domain/childcare'
import { amountForDays, type MealLedger, previewMealPayment } from '@/domain/meal-ledger'
import { receiptTotal } from '@/domain/receipt'
import { useRouter } from '@/i18n/routing'
import { currencyFractionDigits, formatCurrency } from '@/lib/decimal'
import { toastActionError } from '@/lib/toast'
import type { PayableEnrollmentChoice } from '@/use-cases/payments/payable-enrollment-choices'
import type { CashierPaymentMethod } from '@/use-cases/receipts/schemas'
import { recordReceiptAction } from '../../../_lib/receipt-actions'
import {
  SPREAD_TARGET,
  TuitionTargetField,
  targetEnrollmentId,
} from '../../payments/_components/tuition-target-field'
import { suggestTenders } from '../_lib/cash-tender'
import { splitAmount } from '../_lib/split-amount'

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
  /** Inscriptions à régler, pour porter l'écolage sur un seul enfant. */
  tuitionEnrollments: PayableEnrollmentChoice[]
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

function Group({ title, due, children }: { title: string; due?: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-alabaster-700">
      <header className="flex items-baseline justify-between gap-2 bg-alabaster-900 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-graphite">{title}</h3>
        {due && <span className="text-sm font-semibold tabular-nums text-amber-700">{due}</span>}
      </header>
      <ul className="divide-y divide-alabaster-700">{children}</ul>
    </section>
  )
}

function Chip({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="h-7 rounded-full px-3 text-xs"
    >
      {children}
    </Button>
  )
}

function SplitRow({
  lines,
  title,
  step,
  fractionDigits,
  disabled,
  onSplit,
}: {
  lines: CashierLine[]
  title: string
  step: number
  fractionDigits: number
  disabled: boolean
  onSplit: (shares: { line: CashierLine; amount: number }[]) => void
}) {
  const t = useTranslations('dashboard.pages.cashier.split')
  const [amount, setAmount] = useState('')
  const [excluded, setExcluded] = useState<string[]>([])
  const selected = lines.filter((line) => !excluded.includes(line.studentId))
  const value = toAmount(amount)
  const id = `cashier-split-${lines[0]?.service}`

  const split = () => {
    const shares = splitAmount(value, selected.length, fractionDigits)
    if (shares.length === 0) return
    onSplit(selected.map((line, index) => ({ line, amount: shares[index] ?? 0 })))
    setAmount('')
  }

  return (
    <li className="space-y-2 bg-primary/5 px-4 py-3">
      <Label htmlFor={id} className="text-sm font-semibold text-graphite">
        {title}
      </Label>
      <fieldset disabled={disabled} className="flex flex-wrap gap-x-4 gap-y-1">
        <legend className="sr-only">{t('children')}</legend>
        {lines.map((line) => (
          <label key={line.studentId} className="flex items-center gap-1.5 text-sm text-graphite">
            <input
              type="checkbox"
              checked={!excluded.includes(line.studentId)}
              onChange={(event) =>
                setExcluded((current) =>
                  event.target.checked
                    ? current.filter((studentId) => studentId !== line.studentId)
                    : [...current, line.studentId]
                )
              }
              className="size-4 accent-primary"
            />
            {line.name}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
              event.preventDefault()
              split()
            }
          }}
          disabled={disabled}
          className="w-32 text-right tabular-nums"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || value <= 0 || selected.length === 0}
          onClick={split}
        >
          {t('apply', { count: selected.length })}
        </Button>
      </div>
    </li>
  )
}

export function CashierForm({
  familyId,
  lines,
  childcare,
  tuitionDue,
  tuitionEnrollments,
  currency,
  locale,
}: Props) {
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
  const [tuitionTarget, setTuitionTarget] = useState(SPREAD_TARGET)
  const [method, setMethod] = useState<CashierPaymentMethod>('CASH')
  const [reference, setReference] = useState('')
  const [tendered, setTendered] = useState('')

  const fractionDigits = currencyFractionDigits(currency)
  const step = 1 / 10 ** fractionDigits
  const money = (value: number) => formatCurrency(value, locale, currency)
  const formatDay = (day: string) =>
    new Date(`${day}T00:00:00.000Z`).toLocaleDateString(locale, {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
    })

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
  const tuitionEnrollmentId = tuitionAmount > 0 ? targetEnrollmentId(tuitionTarget) : undefined
  const tuitionPayable =
    tuitionEnrollments.find((enrollment) => enrollment.enrollmentId === tuitionTarget)
      ?.remainingBalance ?? tuitionDue
  const childcareLines = childcare.flatMap((line) => {
    const amount = toAmount(childcareAmounts[line.chargeId])
    return amount > 0 ? [{ chargeId: line.chargeId, amount }] : []
  })
  const total = receiptTotal({ tuition: tuitionAmount, meals, childcare: childcareLines })

  const mealsDue = lines.reduce(
    (sum, line) => (line.unitPrice === null ? sum : sum + line.dueAmount),
    0
  )
  const childcareDue = childcare.reduce((sum, line) => sum + line.remaining, 0)

  const receiptLines = [
    ...lines.flatMap((line) => {
      const amount = toAmount(amounts[lineKey(line)])
      return amount > 0 && line.unitPrice !== null
        ? [{ key: lineKey(line), label: `${line.name} · ${tServices(line.service)}`, amount }]
        : []
    }),
    ...childcare.flatMap((line) => {
      const amount = toAmount(childcareAmounts[line.chargeId])
      return amount > 0
        ? [
            {
              key: line.chargeId,
              label: `${line.name} · ${t('childcare')} ${formatChildcareMonth(line.month, locale)}`,
              amount,
            },
          ]
        : []
    }),
    ...(tuitionAmount > 0 ? [{ key: 'tuition', label: t('tuition'), amount: tuitionAmount }] : []),
  ]

  const tenderedAmount = toAmount(tendered)
  const change = tenderedAmount - total

  const setAmount = (line: CashierLine, value: number) =>
    setAmounts((current) => ({ ...current, [lineKey(line)]: String(value) }))

  const splitGroups = (['CANTEEN', 'SNACK'] as const)
    .map((service) => ({
      service,
      lines: lines.filter((line) => line.service === service && line.unitPrice !== null),
    }))
    .filter((group) => group.lines.length > 1)

  const submit = () => {
    if (isPending || total <= 0) return
    startTransition(async () => {
      const { key, storageKey } = idempotencyKey(familyId)
      const result = await recordReceiptAction({
        idempotencyKey: key,
        familyId,
        method,
        reference: reference.trim() || undefined,
        tuition: tuitionAmount,
        tuitionEnrollmentId,
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
      router.push(`/dashboard/cashier?receipt=${result.id}`)
    })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          submit()
        }
      }}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div className="space-y-4">
        {lines.length === 0 && childcare.length === 0 && (
          <p className="rounded-lg border border-alabaster-700 p-4 text-sm text-graphite-600">
            {t('noLines')}
          </p>
        )}

        {lines.length > 0 && (
          <Group
            title={t('groups.meals')}
            due={mealsDue > 0 ? t('groups.due', { amount: money(mealsDue) }) : undefined}
          >
            {splitGroups.map((group) => (
              <SplitRow
                key={group.service}
                lines={group.lines}
                title={t('split.title', { service: tServices(group.service) })}
                step={step}
                fractionDigits={fractionDigits}
                disabled={isPending}
                onSplit={(shares) =>
                  setAmounts((current) => ({
                    ...current,
                    ...Object.fromEntries(
                      shares.map((share) => [lineKey(share.line), String(share.amount)])
                    ),
                  }))
                }
              />
            ))}
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
                <li key={lineKey(line)} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Label htmlFor={id} className="text-sm font-semibold text-graphite">
                      {line.name} · {tServices(line.service)}
                    </Label>
                    <span className="text-xs text-graphite-600">
                      {line.paidThrough
                        ? t('paidThrough', { date: formatDay(line.paidThrough) })
                        : t('nothingPaid')}
                      {line.dueDays > 0 && (
                        <span className="font-semibold text-amber-700">
                          {` · ${t('due', { days: line.dueDays, amount: money(line.dueAmount) })}`}
                        </span>
                      )}
                    </span>
                  </div>
                  {unitPrice === null ? (
                    <p className="text-sm text-amber-600">{t('errors.noPrice')}</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          {quick.map((option) => (
                            <Chip
                              key={option.key}
                              disabled={isPending}
                              onClick={() =>
                                setAmount(
                                  line,
                                  amountForDays(option.days, unitPrice, line.ledger.credit)
                                )
                              }
                            >
                              {t(`quick.${option.key}`)}
                            </Chip>
                          ))}
                          {line.dueAmount > 0 && (
                            <Chip
                              disabled={isPending}
                              onClick={() => setAmount(line, line.dueAmount)}
                            >
                              {t('quick.settle')}
                            </Chip>
                          )}
                        </div>
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
                          className="w-32 text-right tabular-nums"
                        />
                      </div>
                      <p className="text-xs text-graphite-600">
                        {t('unitPrice', { amount: money(unitPrice) })}
                      </p>
                      {preview && (
                        <div className="space-y-1">
                          <p className="flex flex-wrap items-center gap-x-2 rounded-md bg-primary/5 px-3 py-1.5 text-sm text-graphite">
                            <span>
                              {line.paidThrough
                                ? t('previewShift', {
                                    from: formatDay(line.paidThrough),
                                    to: preview.newPaidThrough
                                      ? formatDay(preview.newPaidThrough)
                                      : '—',
                                  })
                                : t('previewFirst', {
                                    to: preview.newPaidThrough
                                      ? formatDay(preview.newPaidThrough)
                                      : '—',
                                  })}
                            </span>
                            <span className="ml-auto font-semibold">
                              {t('previewDays', { days: preview.daysAdded })}
                            </span>
                          </p>
                          {preview.remainder > 0 && (
                            <p className="text-xs text-graphite-600">
                              {t('remainder', { amount: money(preview.remainder) })}
                            </p>
                          )}
                          {preview.warnings.map((warning) => (
                            <p
                              key={warning}
                              className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700"
                            >
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
          </Group>
        )}

        {childcare.length > 0 && (
          <Group
            title={t('childcare')}
            due={childcareDue > 0 ? t('groups.due', { amount: money(childcareDue) }) : undefined}
          >
            {childcare.map((line) => {
              const id = `cashier-childcare-${line.chargeId}`
              return (
                <li key={line.chargeId} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Label htmlFor={id} className="text-sm font-semibold text-graphite">
                      {line.name} · {formatChildcareMonth(line.month, locale)}
                    </Label>
                    <span className="text-xs text-graphite-600">
                      {t('childcareDue', { amount: money(line.remaining) })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Chip
                      disabled={isPending}
                      onClick={() =>
                        setChildcareAmounts((current) => ({
                          ...current,
                          [line.chargeId]: String(line.remaining),
                        }))
                      }
                    >
                      {t('quick.settle')}
                    </Chip>
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
                      className="w-32 text-right tabular-nums"
                    />
                  </div>
                </li>
              )
            })}
          </Group>
        )}

        {tuitionDue !== null && (
          <Group
            title={t('tuition')}
            due={
              tuitionDue > 0
                ? t('tuitionDue', { amount: money(tuitionPayable ?? tuitionDue) })
                : undefined
            }
          >
            {tuitionDue > 0 ? (
              <li className="space-y-2 px-4 py-3">
                <TuitionTargetField
                  id="cashier-tuition-target"
                  enrollments={tuitionEnrollments}
                  value={tuitionTarget}
                  onChange={setTuitionTarget}
                  currency={currency}
                  disabled={isPending}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Chip
                    disabled={isPending}
                    onClick={() => setTuition(String(tuitionPayable ?? tuitionDue))}
                  >
                    {t('quick.settle')}
                  </Chip>
                  <Input
                    id="cashier-tuition"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={tuitionPayable ?? tuitionDue}
                    step={step}
                    value={tuition}
                    onChange={(event) => setTuition(event.target.value)}
                    disabled={isPending}
                    aria-label={t('tuition')}
                    className="w-32 text-right tabular-nums"
                  />
                </div>
              </li>
            ) : (
              <li className="px-4 py-3 text-sm text-graphite-600">{t('tuitionUpToDate')}</li>
            )}
          </Group>
        )}
      </div>

      <aside className="space-y-4 rounded-lg border border-alabaster-700 bg-alabaster-900 p-4 lg:sticky lg:top-4">
        <h3 className="text-base font-semibold text-graphite">{t('panel.title')}</h3>
        {receiptLines.length === 0 ? (
          <p className="text-sm text-graphite-600">{t('panel.empty')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {receiptLines.map((line) => (
              <li key={line.key} className="flex justify-between gap-3">
                <span className="text-graphite-600">{line.label}</span>
                <span className="tabular-nums text-graphite">{money(line.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-baseline justify-between border-t-2 border-graphite pt-3">
          <span className="text-sm font-medium text-graphite">{t('panel.total')}</span>
          <span className="text-2xl font-bold tabular-nums text-graphite">{money(total)}</span>
        </p>

        <fieldset disabled={isPending} className="space-y-2">
          <legend className="mb-2 text-sm font-medium leading-none">{t('method')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((value) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer items-center justify-center rounded border bg-white p-2.5 text-xs font-medium transition-colors',
                  method === value
                    ? 'border-2 border-primary text-foreground'
                    : 'border-alabaster-700 text-graphite-600 hover:border-alabaster'
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

        {method === 'CASH' && total > 0 && (
          <div className="space-y-2 rounded-md border border-alabaster-700 bg-white p-3">
            <Label htmlFor="cashier-tendered">{t('panel.tendered')}</Label>
            <Input
              id="cashier-tendered"
              type="number"
              inputMode="decimal"
              min={0}
              step={step}
              value={tendered}
              onChange={(event) => setTendered(event.target.value)}
              disabled={isPending}
              className="tabular-nums"
            />
            <div className="flex flex-wrap gap-1.5">
              <Chip disabled={isPending} onClick={() => setTendered(String(total))}>
                {t('panel.exact')}
              </Chip>
              {suggestTenders(total).map((value) => (
                <Chip key={value} disabled={isPending} onClick={() => setTendered(String(value))}>
                  {money(value)}
                </Chip>
              ))}
            </div>
            {tenderedAmount > 0 && (
              <p
                className={cn(
                  'flex justify-between text-sm font-semibold',
                  change >= 0 ? 'text-green-700' : 'text-amber-700'
                )}
              >
                <span>{change >= 0 ? t('panel.change') : t('panel.missing')}</span>
                <span className="tabular-nums">{money(Math.abs(change))}</span>
              </p>
            )}
          </div>
        )}

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

        <Button type="submit" disabled={isPending || total <= 0} className="h-12 w-full text-base">
          {total > 0 ? t('submitAmount', { amount: money(total) }) : t('submit')}
        </Button>
        <p className="text-center text-xs text-graphite-600">{t('panel.shortcut')}</p>
      </aside>
    </form>
  )
}
