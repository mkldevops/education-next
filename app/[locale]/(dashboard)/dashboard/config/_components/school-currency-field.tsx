'use client'

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'
import { SCHOOL_CURRENCIES } from '@/domain/school-currency'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import type { SchoolCurrencySettings } from '@/use-cases/schools/school-currency'
import { setSchoolCurrencyAction } from '../../../_lib/school-currency-actions'

/**
 * Devise de l'école. Le choix se fige au premier montant enregistré : la raison s'affiche
 * plutôt qu'un sélecteur qui refuserait chaque essai.
 */
export function SchoolCurrencyField({ settings }: { settings: SchoolCurrencySettings }) {
  const t = useTranslations('dashboard.pages.config.currency')
  const router = useRouter()
  const triggerId = useId()
  const [currency, setCurrency] = useState(settings.currency)
  const [pending, startTransition] = useTransition()

  const items = SCHOOL_CURRENCIES.map((code) => ({ value: code, label: t(`options.${code}`) }))

  const onChange = (next: string) => {
    const previous = currency
    setCurrency(next)
    startTransition(async () => {
      // Un refus comme un rejet réseau remettent l'ancienne devise : le sélecteur ne doit
      // pas afficher un réglage qui n'a pas été enregistré.
      try {
        const result = await setSchoolCurrencyAction(next)
        if (result !== 'OK') {
          setCurrency(previous)
          toast.error(t(result === 'currencyLocked' ? 'locked' : 'error'))
          return
        }
        toast.success(t('saved'))
        router.refresh()
      } catch {
        setCurrency(previous)
        toast.error(t('error'))
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Label htmlFor={triggerId} className="text-sm font-semibold text-graphite">
          {t('label')}
        </Label>
        <p className="mt-1 text-sm text-graphite-600">{t('description')}</p>
        <p className="mt-1 text-xs text-graphite-600">{t('stripeHint')}</p>
        {settings.locked && <p className="mt-2 text-xs text-orange-600">{t('locked')}</p>}
      </div>
      <Select
        items={items}
        value={currency}
        disabled={pending || settings.locked}
        onValueChange={(value) => value !== null && value !== currency && onChange(value)}
      >
        <SelectTrigger id={triggerId} className="w-full shrink-0 sm:w-48">
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
