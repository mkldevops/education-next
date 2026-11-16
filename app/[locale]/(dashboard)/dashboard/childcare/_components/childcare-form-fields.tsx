'use client'

import { Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export const MONTH_PATTERN = '\\d{4}-\\d{2}'
export const PHONE_PATTERN = '\\+?[\\d\\s\\(\\)\\.\\-]{6,20}'

export type Subscription = {
  studentId: string
  name: string
  monthlyAmount: number
  startMonth: string
  endMonth: string | null
}

export function RateField({
  id,
  rates,
  defaultValue,
  disabled,
}: {
  id: string
  rates: number[]
  defaultValue?: number
  disabled: boolean
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const [value, setValue] = useState(defaultValue === undefined ? '' : String(defaultValue))
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t('form.monthlyAmount')}</Label>
      <Input
        id={id}
        name="monthlyAmount"
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
        disabled={disabled}
      />
      {rates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-graphite-600">
          {t('form.knownRates')}
          {rates.map((rate) => (
            <button
              key={rate}
              type="button"
              disabled={disabled}
              onClick={() => setValue(String(rate))}
              className={cn(
                'rounded-full border px-2 py-0.5 tabular-nums',
                value === String(rate)
                  ? 'border-primary bg-primary/15 text-graphite'
                  : 'border-alabaster-700 hover:bg-alabaster-900'
              )}
            >
              {rate.toLocaleString()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
