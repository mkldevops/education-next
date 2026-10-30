'use client'

import { Button, Input, Label } from '@peaklab/ui'
import { useLocale, useTranslations } from 'next-intl'
import { useId } from 'react'
import { annualPlanAmount, type PaymentSchedule, type PlanPricing } from '@/domain/payment-schedule'
import {
  currencyFractionDigits,
  currencyStep,
  currencySymbol,
  formatCurrency,
  roundHalfUp,
} from '@/lib/decimal'

export type PlanConfiguration = {
  pricing: PlanPricing
  paymentSchedule: PaymentSchedule
}

const installmentKeys = ['first', 'second', 'third', 'fourth', 'fifth'] as const

const selectClassName =
  'h-10 w-full rounded border border-alabaster-700 bg-white px-3 text-sm text-graphite focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50'

export function PlanConfigurationFields({
  value,
  onChange,
  currency,
  disabled,
}: {
  value: PlanConfiguration
  onChange: (value: PlanConfiguration) => void
  currency: string
  disabled: boolean
}) {
  const t = useTranslations('dashboard.pages.plans.configuration')
  const locale = useLocale()
  const id = useId()
  const { pricing, paymentSchedule: schedule } = value
  const total = annualPlanAmount(pricing)
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, index, 1))
    ),
  }))
  const setPricing = (next: PlanPricing) => onChange({ ...value, pricing: next })
  const setSchedule = (next: PaymentSchedule) => onChange({ ...value, paymentSchedule: next })
  const count =
    schedule.mode === 'NONE'
      ? 0
      : schedule.mode === 'INSTALLMENTS'
        ? schedule.dates.length
        : schedule.count

  function changeMode(mode: PaymentSchedule['mode']) {
    if (mode === 'NONE') setSchedule({ mode })
    else if (mode === 'INSTALLMENTS') setSchedule({ mode, dates: [{ month: 9, day: 5 }] })
    else setSchedule({ mode, firstMonth: 9, count: mode === 'MONTHLY' ? 10 : 3, dueDay: 5 })
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-4" disabled={disabled}>
        <legend className="mb-3 font-medium text-graphite">{t('priceTitle')}</legend>
        <div className="space-y-2">
          <Label htmlFor={`${id}-basis`}>{t('priceBasis')}</Label>
          <select
            id={`${id}-basis`}
            className={selectClassName}
            value={pricing.mode}
            onChange={(event) => {
              if (event.target.value === 'MONTHLY')
                setPricing({
                  mode: 'MONTHLY',
                  amount: roundHalfUp(pricing.amount / 10, currencyFractionDigits(currency)),
                  months: 10,
                })
              else setPricing({ mode: 'ANNUAL', amount: total })
            }}
          >
            <option value="ANNUAL">{t('annual')}</option>
            <option value="MONTHLY">{t('monthlyPrice')}</option>
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-amount`}>
              {t(pricing.mode === 'ANNUAL' ? 'annualAmount' : 'monthlyAmount', {
                currency: currencySymbol(locale, currency),
              })}
            </Label>
            <Input
              id={`${id}-amount`}
              name="priceAmount"
              type="number"
              value={pricing.amount || ''}
              onChange={(event) => setPricing({ ...pricing, amount: Number(event.target.value) })}
              step={currencyStep(currency)}
              min={currencyStep(currency)}
              required
            />
          </div>
          {pricing.mode === 'MONTHLY' && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-months`}>{t('priceMonths')}</Label>
              <Input
                id={`${id}-months`}
                type="number"
                value={pricing.months || ''}
                min={1}
                max={12}
                step={1}
                required
                onChange={(event) => setPricing({ ...pricing, months: Number(event.target.value) })}
              />
            </div>
          )}
        </div>
        <p className="rounded bg-primary-light p-3 font-medium text-graphite" aria-live="polite">
          {t('annualTotal', { amount: formatCurrency(total, locale, currency) })}
        </p>
      </fieldset>
      <fieldset className="space-y-4" disabled={disabled}>
        <legend className="mb-3 font-medium text-graphite">{t('trackingTitle')}</legend>
        <div className="space-y-2">
          <Label htmlFor={`${id}-tracking`}>{t('trackingMode')}</Label>
          <select
            id={`${id}-tracking`}
            className={selectClassName}
            value={schedule.mode}
            onChange={(event) => changeMode(event.target.value as PaymentSchedule['mode'])}
          >
            <option value="NONE">{t('modes.NONE')}</option>
            <option value="INSTALLMENTS">{t('modes.INSTALLMENTS')}</option>
            <option value="MONTHLY">{t('modes.MONTHLY')}</option>
            <option value="QUARTERLY">{t('modes.QUARTERLY')}</option>
          </select>
          <p className="text-sm text-graphite-600">
            {t(schedule.mode === 'NONE' ? 'noneHelp' : 'trackingHelp')}
          </p>
        </div>
        {(schedule.mode === 'MONTHLY' || schedule.mode === 'QUARTERLY') && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`${id}-first-month`}>{t('firstMonth')}</Label>
              <select
                id={`${id}-first-month`}
                className={selectClassName}
                value={schedule.firstMonth}
                onChange={(event) =>
                  setSchedule({ ...schedule, firstMonth: Number(event.target.value) })
                }
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-count`}>{t('paymentCount')}</Label>
              <Input
                id={`${id}-count`}
                type="number"
                value={schedule.count || ''}
                min={1}
                max={schedule.mode === 'MONTHLY' ? 12 : 4}
                step={1}
                required
                onChange={(event) =>
                  setSchedule({ ...schedule, count: Number(event.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-day`}>{t('dueDay')}</Label>
              <Input
                id={`${id}-day`}
                type="number"
                value={schedule.dueDay || ''}
                min={1}
                max={31}
                step={1}
                required
                onChange={(event) =>
                  setSchedule({ ...schedule, dueDay: Number(event.target.value) })
                }
              />
            </div>
          </div>
        )}
        {schedule.mode === 'INSTALLMENTS' && (
          <div className="space-y-3">
            {schedule.dates.map((date, index) => (
              <div
                key={installmentKeys[index]}
                className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3"
              >
                <div className="space-y-2">
                  <Label htmlFor={`${id}-month-${index}`}>
                    {t('installmentMonth', { number: index + 1 })}
                  </Label>
                  <select
                    id={`${id}-month-${index}`}
                    className={selectClassName}
                    value={date.month}
                    onChange={(event) =>
                      setSchedule({
                        ...schedule,
                        dates: schedule.dates.map((item, i) =>
                          i === index ? { ...item, month: Number(event.target.value) } : item
                        ),
                      })
                    }
                  >
                    {months.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-day-${index}`}>
                    {t('installmentDay', { number: index + 1 })}
                  </Label>
                  <Input
                    id={`${id}-day-${index}`}
                    type="number"
                    value={date.day || ''}
                    min={1}
                    max={31}
                    step={1}
                    required
                    onChange={(event) =>
                      setSchedule({
                        ...schedule,
                        dates: schedule.dates.map((item, i) =>
                          i === index ? { ...item, day: Number(event.target.value) } : item
                        ),
                      })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || schedule.dates.length <= 1}
                  aria-label={t('removeInstallment', { number: index + 1 })}
                  onClick={() =>
                    setSchedule({
                      ...schedule,
                      dates: schedule.dates.filter((_, i) => i !== index),
                    })
                  }
                >
                  {t('remove')}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || schedule.dates.length >= 5}
              onClick={() => {
                const last = schedule.dates[schedule.dates.length - 1]
                setSchedule({
                  ...schedule,
                  dates: [...schedule.dates, { month: (last.month % 12) + 1, day: last.day }],
                })
              }}
            >
              {t('addInstallment')}
            </Button>
          </div>
        )}
        {schedule.mode !== 'NONE' && (
          <div
            className="space-y-2 rounded bg-surface-2 p-3 text-sm text-muted-foreground"
            aria-live="polite"
          >
            <p>
              {t('schedulePreview', {
                count,
                amount: formatCurrency(total / Math.max(1, count), locale, currency),
              })}
            </p>
            <p>{t('dateHelp')}</p>
            <p>{t('roundingHelp')}</p>
          </div>
        )}
      </fieldset>
    </div>
  )
}
