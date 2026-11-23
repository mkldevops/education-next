'use client'

import { Button, Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { splitAmount } from '../_lib/split-amount'
import type { CashierLine } from './cashier-form'

export const toAmount = (value: string | undefined) => {
  const amount = Number((value ?? '').replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}
export function Group({
  title,
  due,
  children,
}: {
  title: string
  due?: string
  children: ReactNode
}) {
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

export function Chip({
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

export function SplitRow({
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
