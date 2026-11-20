'use client'

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@peaklab/ui'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { currencySymbol } from '@/lib/decimal'
import {
  type ArrivalPeriod,
  type ArrivalSchedule,
  arrivalInput,
  arrivalSchedule,
  localToday,
} from '../_lib/arrival-schedule'
import type { PlanOption } from '../_lib/plan-options'
import { InstallmentSchedule } from './installment-schedule'

/**
 * État d'une arrivée en cours d'année dans un formulaire à une seule inscription. Le total suit
 * la part due de la formule tant que l'administrateur ne l'a pas saisi lui-même ; changer de
 * formule, de période (classe d'une autre année), de premier mois ou de montant du premier mois
 * le ramène à cette part.
 */
export function useEnrollmentArrival(
  plan: PlanOption | undefined,
  period: ArrivalPeriod | null,
  currency: string
) {
  const [today] = useState(() => localToday())
  const [startMonth, setStartMonth] = useState('')
  const [firstAmount, setFirstAmount] = useState('')
  const [typedTotal, setTypedTotal] = useState<number | null>(null)
  // Une autre période a d'autres mois et une autre part due : ce qui a été saisi pour l'ancienne
  // ne vaut plus. Ajusté pendant le rendu, comme le recommande React, plutôt que dans un effet.
  const periodKey = period ? `${period.startAt}/${period.endAt}` : null
  const [seenPeriodKey, setSeenPeriodKey] = useState(periodKey)
  if (periodKey !== seenPeriodKey) {
    setSeenPeriodKey(periodKey)
    setStartMonth('')
    setFirstAmount('')
    setTypedTotal(null)
  }
  const owed = arrivalSchedule(plan, period, currency, { startMonth, firstAmount, today })
  const schedule =
    typedTotal === null
      ? owed
      : arrivalSchedule(plan, period, currency, {
          startMonth,
          firstAmount,
          totalAmount: typedTotal,
          today,
        })

  return {
    schedule,
    firstAmount,
    totalAmount: typedTotal ?? owed?.owed ?? plan?.amount ?? 0,
    setTotalAmount: setTypedTotal,
    changePlan: () => {
      setFirstAmount('')
      setTypedTotal(null)
    },
    changeStartMonth: (month: string) => {
      setStartMonth(month)
      setFirstAmount('')
      setTypedTotal(null)
    },
    changeFirstAmount: (value: string) => {
      setFirstAmount(value)
      setTypedTotal(null)
    },
    input: arrivalInput(schedule, firstAmount),
  }
}

interface EnrollmentArrivalFieldsProps {
  idPrefix: string
  /** `null` quand la formule n'a pas d'échéancier ou que la période est inconnue : rien à montrer. */
  schedule: ArrivalSchedule | null
  currency: string
  firstAmount: string
  onStartMonthChange: (month: string) => void
  onFirstAmountChange: (value: string) => void
  disabled?: boolean
}

/**
 * « Arrivé en cours d'année ? » : premier mois à payer et montant de ce mois, au-dessus de
 * l'échéancier qui en résulte. Dépliée dès que la première échéance de la formule est passée,
 * repliée avant : une rentrée ordinaire n'a rien à y saisir.
 */
export function EnrollmentArrivalFields({
  idPrefix,
  schedule,
  currency,
  firstAmount,
  onStartMonthChange,
  onFirstAmountChange,
  disabled,
}: EnrollmentArrivalFieldsProps) {
  const t = useTranslations('dashboard.enrollmentArrival')
  const locale = useLocale()
  if (!schedule) return null

  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const monthItems = schedule.months.map((month) => {
    const label = monthFormat.format(new Date(`${month}-01T00:00:00.000Z`))
    return { value: month, label: label.charAt(0).toUpperCase() + label.slice(1) }
  })
  const hintId = `${idPrefix}-arrival-hint`

  const fields = (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-start-month`}>{t('startMonth')}</Label>
        <Select
          items={monthItems}
          value={schedule.startMonth}
          onValueChange={(value) => onStartMonthChange((value as string | null) ?? '')}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-start-month`} aria-describedby={hintId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p id={hintId} className="text-graphite-600 text-xs">
          {t(schedule.monthly ? 'hint' : 'hintNotMonthly')}
        </p>
      </div>
      <InstallmentSchedule
        installments={schedule.installments}
        currency={currency}
        firstInstallment={
          schedule.monthly
            ? {
                id: `${idPrefix}-first-amount`,
                label: t('firstAmount', { currency: currencySymbol(locale, currency) }),
                value: firstAmount,
                nominal: schedule.nominal,
                onChange: onFirstAmountChange,
                disabled,
                describedBy: hintId,
              }
            : undefined
        }
      />
    </>
  )

  return schedule.pastFirstDue ? (
    <fieldset className="space-y-3 rounded border border-alabaster-700 p-3">
      <legend className="px-1 font-medium text-graphite text-sm">{t('title')}</legend>
      {fields}
    </fieldset>
  ) : (
    <details className="rounded border border-alabaster-700 px-3 py-2">
      <summary className="cursor-pointer font-medium text-graphite text-sm">{t('title')}</summary>
      <div className="mt-3 space-y-3">{fields}</div>
    </details>
  )
}
