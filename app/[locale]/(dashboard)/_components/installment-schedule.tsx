'use client'

import { Button, cn, Input, Label } from '@peaklab/ui'
import { useLocale, useTranslations } from 'next-intl'
import type { PaymentInstallment } from '@/domain/payment-schedule'
import { currencyFractionDigits, currencyStep, formatCurrency, roundHalfUp } from '@/lib/decimal'

/** Première ligne modifiable : le montant du premier mois d'une arrivée en cours d'année. */
export interface FirstInstallmentField {
  id: string
  label: string
  /** Saisie en cours ; vide, la ligne garde le montant calculé en indication. */
  value: string
  /** Échéance de la formule à ce mois : base des raccourcis ½ et ¼, plafond de la saisie. */
  nominal: number
  onChange: (value: string) => void
  disabled?: boolean
  describedBy?: string
}

interface InstallmentScheduleProps {
  installments: PaymentInstallment[]
  /** Échéancier avant la modification : chaque ligne et le total montrent alors « avant → après ». */
  previous?: PaymentInstallment[]
  currency: string
  /** Total de l'inscription quand il ne se lit pas sur les lignes : formule sans échéancier d'un côté. */
  total?: number
  previousTotal?: number
  firstInstallment?: FirstInstallmentField
  className?: string
}

type Row = { dueDate: string; before: number | null; after: number | null }

function amountAt(installments: PaymentInstallment[], dueDate: string): number | null {
  return installments.find((installment) => installment.dueDate === dueDate)?.amount ?? null
}

function scheduleRows(installments: PaymentInstallment[], previous?: PaymentInstallment[]): Row[] {
  const dueDates = [...(previous ?? []), ...installments].map((installment) => installment.dueDate)
  return [...new Set(dueDates)].sort().map((dueDate) => ({
    dueDate,
    before: previous ? amountAt(previous, dueDate) : null,
    after: amountAt(installments, dueDate),
  }))
}

function sum(installments: PaymentInstallment[], currency: string): number {
  return roundHalfUp(
    installments.reduce((total, installment) => total + installment.amount, 0),
    currencyFractionDigits(currency)
  )
}

/**
 * Échéancier « mois → montant » d'une inscription, avec son total recalculé. Partagé par la
 * création d'inscription, la correction du mois de début et la carte de validation de
 * l'assistant : un montant réparti sur plusieurs échéances s'y lit ligne par ligne.
 */
export function InstallmentSchedule({
  installments,
  previous,
  currency,
  total,
  previousTotal,
  firstInstallment,
  className,
}: InstallmentScheduleProps) {
  const t = useTranslations('dashboard.installmentSchedule')
  const locale = useLocale()
  const rows = scheduleRows(installments, previous)
  // Deux échéances du même mois (dates libres) se distinguent par leur jour.
  const months = rows.map((row) => row.dueDate.slice(0, 7))
  const monthLabel = new Intl.DateTimeFormat(
    locale,
    new Set(months).size === months.length
      ? { month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { dateStyle: 'long', timeZone: 'UTC' }
  )
  const money = (amount: number) => formatCurrency(amount, locale, currency)
  const digits = currencyFractionDigits(currency)
  const editableDueDate = firstInstallment ? installments[0]?.dueDate : undefined

  const change = (before: number | null, after: number | null) => {
    if (!previous || before === after) return after === null ? t('none') : money(after)
    return (
      <>
        <span className="text-graphite-600 line-through">
          {before === null ? t('none') : money(before)}
        </span>
        <span aria-hidden className="px-1 text-graphite-600">
          →
        </span>
        <span className="sr-only">{t('becomes')}</span>
        <span className="font-medium">{after === null ? t('none') : money(after)}</span>
      </>
    )
  }

  return (
    <table className={cn('w-full text-sm', className)}>
      <caption className="sr-only">{t('caption')}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">{t('month')}</th>
          <th scope="col">{t('amount')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const month = monthLabel.format(new Date(row.dueDate))
          const editable = firstInstallment && row.dueDate === editableDueDate
          return (
            <tr key={row.dueDate} className="border-alabaster-700 border-b">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal text-graphite">
                <span className="capitalize">{month}</span>
                {editable && (
                  <Label
                    htmlFor={firstInstallment.id}
                    className="block font-normal text-graphite-600 text-xs"
                  >
                    {firstInstallment.label}
                  </Label>
                )}
              </th>
              <td className="py-1.5 text-right tabular-nums">
                {editable ? (
                  <div className="flex items-center justify-end gap-1">
                    <Input
                      id={firstInstallment.id}
                      type="number"
                      inputMode="decimal"
                      step={currencyStep(currency)}
                      min={currencyStep(currency)}
                      max={firstInstallment.nominal}
                      value={firstInstallment.value}
                      placeholder={row.after === null ? undefined : String(row.after)}
                      onChange={(event) => firstInstallment.onChange(event.target.value)}
                      aria-describedby={firstInstallment.describedBy}
                      disabled={firstInstallment.disabled}
                      className="h-8 w-28 text-right"
                    />
                    {(
                      [
                        ['½', 'half', 2],
                        ['¼', 'quarter', 4],
                      ] as const
                    ).map(([symbol, key, divisor]) => {
                      const amount = roundHalfUp(firstInstallment.nominal / divisor, digits)
                      return (
                        <Button
                          key={key}
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={t(key, { amount: money(amount) })}
                          title={t(key, { amount: money(amount) })}
                          disabled={firstInstallment.disabled}
                          onClick={() => firstInstallment.onChange(String(amount))}
                        >
                          {symbol}
                        </Button>
                      )
                    })}
                  </div>
                ) : (
                  change(row.before, row.after)
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" className="pt-2 pr-3 text-left font-medium text-graphite">
            {t('total')}
          </th>
          <td className="pt-2 text-right font-medium tabular-nums">
            {change(
              previous ? (previousTotal ?? sum(previous, currency)) : null,
              total ?? sum(installments, currency)
            )}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}
