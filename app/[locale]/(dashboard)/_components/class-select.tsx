'use client'

import {
  cn,
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
  classItemLabel,
  classLabel,
  groupClassesByLevel,
  isClassFull,
  rankClasses,
  remainingSeats,
  spansSeveralPeriods,
} from '../_lib/class-options'

interface ClassSelectProps {
  id: string
  classes: ClassOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  suggestedLevelId?: string | null
  disabled?: boolean
}

/**
 * Sélecteur de classe sans présélection : les classes du niveau suggéré viennent d'abord, sinon
 * elles sont regroupées par niveau ; chaque classe affiche ses places restantes et une classe
 * complète est signalée, mais reste sélectionnable. Sous un titre de niveau, une option ne répète
 * pas le niveau ; la période n'y figure que si plusieurs périodes sont proposées. Le bouton garde
 * le libellé complet. La liste s'élargit selon son contenu, dans la limite de la fenêtre.
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
  const levelGroups = suggested.length > 0 ? [] : groupClassesByLevel(classes)
  const items = classes.map((c) => ({ value: c.id, label: classLabel(c) }))
  const showPeriod = spansSeveralPeriods(classes)

  const renderItem = (option: ClassOption, showLevel: boolean) => {
    const remaining = remainingSeats(option)
    const full = isClassFull(option)
    return (
      <SelectItem key={option.id} value={option.id}>
        <span className="truncate">{classItemLabel(option, { showLevel, showPeriod })}</span>
        {remaining !== null && (
          <span
            className={cn(
              'ml-auto shrink-0 pl-4 text-xs',
              full ? 'text-danger' : 'text-graphite-600'
            )}
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
      <SelectContent className="w-max min-w-(--anchor-width) max-w-[calc(100vw-2rem)]">
        {suggested.length > 0 ? (
          <>
            <SelectGroup>
              <SelectLabel>{t('suggested')}</SelectLabel>
              {suggested.map((c) => renderItem(c, true))}
            </SelectGroup>
            {others.length > 0 && (
              <SelectGroup>
                <SelectLabel>{t('others')}</SelectLabel>
                {others.map((c) => renderItem(c, true))}
              </SelectGroup>
            )}
          </>
        ) : levelGroups.length > 0 ? (
          levelGroups.map((group) => (
            <SelectGroup key={group.levelName}>
              <SelectLabel>{group.levelName}</SelectLabel>
              {group.classes.map((c) => renderItem(c, false))}
            </SelectGroup>
          ))
        ) : (
          others.map((c) => renderItem(c, true))
        )}
      </SelectContent>
    </Select>
  )
}
