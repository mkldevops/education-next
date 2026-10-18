'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import {
  type ClassOption,
  isClassFull,
  rankClasses,
  remainingSeats,
} from '../_lib/enrollment-options'

interface ClassSelectProps {
  id: string
  classes: ClassOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  suggestedLevelId?: string | null
  disabled?: boolean
}

/**
 * Sélecteur de classe sans présélection : les classes du niveau suggéré viennent d'abord, chaque
 * classe affiche ses places restantes et une classe complète est signalée.
 */
export function ClassSelect({
  id,
  classes,
  value,
  onValueChange,
  suggestedLevelId,
  disabled,
}: ClassSelectProps) {
  const t = useTranslations('dashboard.pages.enrollments.classPicker')
  const { suggested, others } = rankClasses(classes, suggestedLevelId)
  const items = classes.map((c) => ({ value: c.id, label: c.name }))

  const renderItem = (option: ClassOption) => {
    const remaining = remainingSeats(option)
    const full = isClassFull(option)
    return (
      <SelectItem key={option.id} value={option.id}>
        <span className="truncate">{option.name}</span>
        {remaining !== null && (
          <span
            className={full ? 'ml-auto text-xs text-danger' : 'ml-auto text-xs text-graphite-600'}
          >
            {full ? t('full') : t('seats', { remaining, capacity: option.capacity ?? remaining })}
          </span>
        )}
      </SelectItem>
    )
  }

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => onValueChange((next as string | null) ?? null)}
      disabled={disabled}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={t('placeholder')} />
      </SelectTrigger>
      <SelectContent>
        {suggested.length > 0 ? (
          <>
            <SelectGroup>
              <SelectLabel>{t('suggested')}</SelectLabel>
              {suggested.map(renderItem)}
            </SelectGroup>
            {others.length > 0 && (
              <SelectGroup>
                <SelectLabel>{t('others')}</SelectLabel>
                {others.map(renderItem)}
              </SelectGroup>
            )}
          </>
        ) : (
          others.map(renderItem)
        )}
      </SelectContent>
    </Select>
  )
}
