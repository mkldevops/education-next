'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { type ReactNode, useId, useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import {
  ATTENDANCE_ENTRY_MODE_CONFIG_KEY,
  ATTENDANCE_FREQUENCY_CONFIG_KEY,
} from '@/lib/attendance-config'
import {
  type CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY,
  ClassScheduleVisibility,
} from '@/lib/class-schedule-config'
import { toast } from '@/lib/toast'
import { setConfigAction } from '../../../_lib/config-actions'

type SelectConfigKey =
  | typeof ATTENDANCE_FREQUENCY_CONFIG_KEY
  | typeof ATTENDANCE_ENTRY_MODE_CONFIG_KEY
  | typeof CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY

/** Une option d'un module : libellé à gauche, commande à droite. */
export function OptionRow({
  label,
  description,
  labelFor,
  children,
}: {
  label: string
  description?: string
  labelFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0">
        {labelFor ? (
          <label htmlFor={labelFor} className="text-sm font-semibold text-graphite">
            {label}
          </label>
        ) : (
          <p className="text-sm font-semibold text-graphite">{label}</p>
        )}
        {description && <p className="mt-0.5 text-sm text-graphite-600">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** Libellés des valeurs fermées, partagés entre le résumé d'une carte et son sélecteur. */
export function useConfigChoices(name: SelectConfigKey) {
  const t = useTranslations(`dashboard.pages.config.settings.${name}`)
  if (name === ATTENDANCE_FREQUENCY_CONFIG_KEY) {
    return [
      { value: 'PER_SLOT', label: t('perSlot') },
      { value: 'DAILY', label: t('daily') },
    ]
  }
  if (name === ATTENDANCE_ENTRY_MODE_CONFIG_KEY) {
    return [
      { value: 'LIST', label: t('list') },
      { value: 'ONE_BY_ONE', label: t('oneByOne') },
    ]
  }
  return [
    { value: ClassScheduleVisibility.Internal, label: t('internal') },
    { value: ClassScheduleVisibility.Public, label: t('public') },
  ]
}

/**
 * Sélecteur enregistré dès le choix. Un refus remet la valeur précédente : le sélecteur ne
 * doit pas afficher un réglage qui n'a pas été écrit.
 */
export function ConfigSelectRow({ name, value }: { name: SelectConfigKey; value: string }) {
  const t = useTranslations('dashboard.pages.config')
  const router = useRouter()
  const triggerId = useId()
  const items = useConfigChoices(name)
  const [current, setCurrent] = useState(
    items.find((item) => item.value === value)?.value ?? items[0]?.value ?? ''
  )
  const [pending, startTransition] = useTransition()

  const onChange = (next: string) => {
    const previous = current
    setCurrent(next)
    startTransition(async () => {
      try {
        const result = await setConfigAction({ name, value: next })
        if (typeof result === 'string') {
          setCurrent(previous)
          toast.error(t('edit.error'))
          return
        }
        toast.success(t('edit.success'))
        router.refresh()
      } catch {
        setCurrent(previous)
        toast.error(t('edit.error'))
      }
    })
  }

  return (
    <OptionRow label={t(`settings.${name}.label`)} labelFor={triggerId}>
      <Select
        items={items}
        value={current}
        disabled={pending}
        onValueChange={(next) => next && onChange(next)}
      >
        <SelectTrigger id={triggerId} className="w-44">
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
    </OptionRow>
  )
}
