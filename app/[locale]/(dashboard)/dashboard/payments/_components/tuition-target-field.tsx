'use client'

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@peaklab/ui'
import { useFormatter, useTranslations } from 'next-intl'
import type { PayableEnrollmentChoice } from '@/use-cases/payments/payable-enrollment-choices'

export const SPREAD_TARGET = 'family'

/**
 * Choix de la cible d'un règlement d'écolage : réparti sur la famille (défaut) ou porté sur
 * l'inscription d'un enfant. Masqué tant qu'il n'y a pas au moins deux inscriptions à régler.
 */
export function TuitionTargetField({
  id,
  enrollments,
  value,
  onChange,
  currency,
  disabled,
}: {
  id: string
  enrollments: PayableEnrollmentChoice[]
  value: string
  onChange: (value: string) => void
  currency: string
  disabled?: boolean
}) {
  const t = useTranslations('dashboard.pages.payments.record.target')
  const format = useFormatter()

  if (enrollments.length < 2) return null

  const items = [
    { value: SPREAD_TARGET, label: t('spread') },
    ...enrollments.map((enrollment) => ({
      value: enrollment.enrollmentId,
      label: t('child', {
        name: enrollment.studentName,
        amount: format.number(enrollment.remainingBalance, { style: 'currency', currency }),
      }),
    })),
  ]

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t('label')}</Label>
      <Select
        items={items}
        value={value}
        disabled={disabled}
        onValueChange={(next) => next !== null && onChange(next)}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function targetEnrollmentId(value: string): string | undefined {
  return value === SPREAD_TARGET ? undefined : value
}
