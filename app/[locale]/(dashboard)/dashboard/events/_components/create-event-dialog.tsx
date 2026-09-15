'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  Textarea,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import type { EventCategory, EventVisibility } from '@/generated/prisma/client'
import { parseEventInputValue, toEventInputValue } from '@/lib/date'
import { createEventAction } from '../../../_lib/event-actions'
import { EVENT_CATEGORY_VALUES, EVENT_VISIBILITY_VALUES } from './event-enum-values'

export function CreateEventDialog() {
  const tCreate = useTranslations('dashboard.pages.events.create')

  return (
    <Dialog>
      <DialogTrigger>
        <Button>
          <Plus className="h-4 w-4" />
          {tCreate('trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tCreate('title')}</DialogTitle>
        </DialogHeader>
        <CreateEventForm />
      </DialogContent>
    </Dialog>
  )
}

function CreateEventForm() {
  const t = useTranslations('dashboard.pages.events')
  const tCreate = useTranslations('dashboard.pages.events.create')
  const tCategory = useTranslations('eventCategory')
  const tVisibility = useTranslations('eventVisibility')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const [allDay, setAllDay] = useState(true)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')

  const handleSubmit = onSubmit(
    (formData) => {
      const endAtValue = formData.get('endAt') as string
      const announceDaysValue = formData.get('announceDaysBefore') as string

      return createEventAction({
        title: formData.get('title') as string,
        summary: (formData.get('summary') as string) || null,
        description: (formData.get('description') as string) || null,
        category: formData.get('category') as EventCategory,
        visibility: formData.get('visibility') as EventVisibility,
        allDay,
        startAt: parseEventInputValue(formData.get('startAt') as string),
        endAt: endAtValue ? parseEventInputValue(endAtValue) : null,
        location: (formData.get('location') as string) || null,
        announceDaysBefore: announceDaysValue ? Number(announceDaysValue) : null,
      })
    },
    { successKey: 'success.created' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">{t('fields.title')}</Label>
            <Input id="event-title" name="title" required maxLength={120} disabled={isPending} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-category">{t('fields.category')}</Label>
              <Select id="event-category" name="category" required disabled={isPending}>
                {EVENT_CATEGORY_VALUES.map((category) => (
                  <option key={category} value={category}>
                    {tCategory(category)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-visibility">{t('fields.visibility')}</Label>
              <Select
                id="event-visibility"
                name="visibility"
                defaultValue="MEMBERS"
                disabled={isPending}
              >
                {EVENT_VISIBILITY_VALUES.map((visibility) => (
                  <option key={visibility} value={visibility}>
                    {tVisibility(visibility)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-graphite">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => {
                const nextAllDay = e.target.checked
                setAllDay(nextAllDay)
                // La valeur saisie n'est pas valide pour le nouveau type : sans conversion
                // explicite, React réécrit `type` puis le navigateur vide le champ.
                if (startAt)
                  setStartAt(toEventInputValue(parseEventInputValue(startAt), nextAllDay))
                if (endAt) setEndAt(toEventInputValue(parseEventInputValue(endAt), nextAllDay))
              }}
              disabled={isPending}
              className="h-4 w-4 rounded border-alabaster"
            />
            {t('fields.allDay')}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-start-at">{t('fields.startAt')}</Label>
              <Input
                id="event-start-at"
                name="startAt"
                type={allDay ? 'date' : 'datetime-local'}
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end-at">{t('fields.endAt')}</Label>
              <Input
                id="event-end-at"
                name="endAt"
                type={allDay ? 'date' : 'datetime-local'}
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-location">{t('fields.location')}</Label>
            <Input id="event-location" name="location" maxLength={250} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-summary">{t('fields.summary')}</Label>
            <Input id="event-summary" name="summary" maxLength={280} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-description">{t('fields.description')}</Label>
            <Textarea id="event-description" name="description" disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-announce-days">{t('fields.announceDays')}</Label>
            <Input
              id="event-announce-days"
              name="announceDaysBefore"
              type="number"
              min="0"
              step="1"
              disabled={isPending}
            />
            <p className="text-xs text-graphite-600">{t('fields.announceDaysHint')}</p>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={tCreate} isPending={isPending} onCancel={close} />
    </form>
  )
}
