'use client'

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import type { EventCategory, EventVisibility } from '@/generated/prisma/client'
import { parseEventInputValue, toEventInputValue } from '@/lib/date'
import { EVENT_CATEGORY_VALUES, EVENT_VISIBILITY_VALUES } from './event-enum-values'

type EventDateValues = {
  allDay: boolean
  startAt: string
  endAt: string
}

type EventDateFields = EventDateValues & {
  setStartAt: (value: string) => void
  setEndAt: (value: string) => void
  onAllDayChange: (next: boolean) => void
}

export function useEventDateFields(initial: EventDateValues | (() => EventDateValues)) {
  const [values, setValues] = useState(initial)
  const { allDay, startAt, endAt } = values

  return {
    allDay,
    startAt,
    endAt,
    setStartAt: (value: string) => setValues((current) => ({ ...current, startAt: value })),
    setEndAt: (value: string) => setValues((current) => ({ ...current, endAt: value })),
    onAllDayChange: (next: boolean) =>
      // La valeur saisie n'est pas valide pour le nouveau type : sans conversion explicite,
      // un changement de `type` vide le champ au lieu de le repositionner.
      setValues({
        allDay: next,
        startAt: startAt ? toEventInputValue(parseEventInputValue(startAt), next) : startAt,
        endAt: endAt ? toEventInputValue(parseEventInputValue(endAt), next) : endAt,
      }),
  } satisfies EventDateFields
}

type EventFormDefaults = {
  title?: string
  category?: EventCategory
  visibility: EventVisibility
  location?: string
  summary?: string
  description?: string
  announceDaysBefore?: number
}

type EventFormFieldsProps = {
  idPrefix: 'event' | 'edit-event'
  defaults: EventFormDefaults
  isPending: boolean
  dates: EventDateFields
  statusSlot?: ReactNode
}

export function EventFormFields({
  idPrefix,
  defaults,
  isPending,
  dates,
  statusSlot,
}: EventFormFieldsProps) {
  const t = useTranslations('dashboard.pages.events')
  const tCategory = useTranslations('eventCategory')
  const tVisibility = useTranslations('eventVisibility')
  const categoryItems = EVENT_CATEGORY_VALUES.map((category) => ({
    value: category,
    label: tCategory(category),
  }))
  const visibilityItems = EVENT_VISIBILITY_VALUES.map((visibility) => ({
    value: visibility,
    label: tVisibility(visibility),
  }))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>{t('fields.title')}</Label>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          required
          maxLength={120}
          defaultValue={defaults.title}
          disabled={isPending}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-category`}>{t('fields.category')}</Label>
          <Select
            name="category"
            items={categoryItems}
            defaultValue={defaults.category ?? categoryItems[0]?.value}
            required
            disabled={isPending}
          >
            <SelectTrigger id={`${idPrefix}-category`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-visibility`}>{t('fields.visibility')}</Label>
          <Select
            name="visibility"
            items={visibilityItems}
            defaultValue={defaults.visibility}
            disabled={isPending}
          >
            <SelectTrigger id={`${idPrefix}-visibility`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibilityItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {statusSlot}
      <label className="flex items-center gap-2 text-sm text-graphite">
        <input
          type="checkbox"
          checked={dates.allDay}
          onChange={(e) => dates.onAllDayChange(e.target.checked)}
          disabled={isPending}
          className="h-4 w-4 rounded border-alabaster"
        />
        {t('fields.allDay')}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-start-at`}>{t('fields.startAt')}</Label>
          <Input
            id={`${idPrefix}-start-at`}
            name="startAt"
            type={dates.allDay ? 'date' : 'datetime-local'}
            value={dates.startAt}
            onChange={(e) => dates.setStartAt(e.target.value)}
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-end-at`}>{t('fields.endAt')}</Label>
          <Input
            id={`${idPrefix}-end-at`}
            name="endAt"
            type={dates.allDay ? 'date' : 'datetime-local'}
            value={dates.endAt}
            onChange={(e) => dates.setEndAt(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-location`}>{t('fields.location')}</Label>
        <Input
          id={`${idPrefix}-location`}
          name="location"
          maxLength={250}
          defaultValue={defaults.location}
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-summary`}>{t('fields.summary')}</Label>
        <Input
          id={`${idPrefix}-summary`}
          name="summary"
          maxLength={280}
          defaultValue={defaults.summary}
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>{t('fields.description')}</Label>
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          defaultValue={defaults.description}
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-announce-days`}>{t('fields.announceDays')}</Label>
        <Input
          id={`${idPrefix}-announce-days`}
          name="announceDaysBefore"
          type="number"
          min="0"
          step="1"
          defaultValue={defaults.announceDaysBefore}
          disabled={isPending}
        />
        <p className="text-xs text-graphite-600">{t('fields.announceDaysHint')}</p>
      </div>
    </div>
  )
}

export function readEventFormPayload(formData: FormData, dates: EventDateValues) {
  const announceDaysValue = formData.get('announceDaysBefore') as string

  return {
    title: formData.get('title') as string,
    summary: (formData.get('summary') as string) || null,
    description: (formData.get('description') as string) || null,
    category: formData.get('category') as EventCategory,
    visibility: formData.get('visibility') as EventVisibility,
    allDay: dates.allDay,
    startAt: parseEventInputValue(dates.startAt),
    endAt: dates.endAt ? parseEventInputValue(dates.endAt) : null,
    location: (formData.get('location') as string) || null,
    announceDaysBefore: announceDaysValue ? Number(announceDaysValue) : null,
  }
}
