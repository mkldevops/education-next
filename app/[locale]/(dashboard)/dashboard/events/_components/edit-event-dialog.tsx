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
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import type {
  Event,
  EventCategory,
  EventImage,
  EventStatus,
  EventVisibility,
} from '@/generated/prisma/client'
import { updateEventAction } from '../../../_lib/event-actions'
import {
  EVENT_CATEGORY_VALUES,
  EVENT_STATUS_VALUES,
  EVENT_VISIBILITY_VALUES,
} from './event-enum-values'
import { EventImagesField } from './event-images-field'

type EditableEvent = Pick<
  Event,
  | 'id'
  | 'title'
  | 'summary'
  | 'description'
  | 'category'
  | 'visibility'
  | 'status'
  | 'allDay'
  | 'startAt'
  | 'endAt'
  | 'location'
  | 'announceDaysBefore'
> & {
  images: Pick<EventImage, 'id' | 'storageKey' | 'alt' | 'position'>[]
}

type Props = {
  event: EditableEvent
}

// `date` attend AAAA-MM-JJ en UTC (un événement journée entière est stocké à minuit
// UTC) ; `datetime-local` attend l'heure murale locale, sans fuseau, donc les
// composants locaux de `value` plutôt que ses équivalents UTC.
function toInputDateValue(value: Date, allDay: boolean): string {
  if (allDay) return value.toISOString().slice(0, 10)

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(
    value.getHours()
  )}:${pad(value.getMinutes())}`
}

export function EditEventDialog({ event }: Props) {
  const tEdit = useTranslations('dashboard.pages.events.edit')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {tEdit('trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tEdit('title')}</DialogTitle>
        </DialogHeader>
        <EditEventForm event={event} />
      </DialogContent>
    </Dialog>
  )
}

function EditEventForm({ event }: Props) {
  const t = useTranslations('dashboard.pages.events')
  const tEdit = useTranslations('dashboard.pages.events.edit')
  const tCategory = useTranslations('eventCategory')
  const tVisibility = useTranslations('eventVisibility')
  const tStatus = useTranslations('eventStatus')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const [allDay, setAllDay] = useState(event.allDay)

  const handleSubmit = onSubmit(
    (formData) => {
      const endAtValue = formData.get('endAt') as string
      const announceDaysValue = formData.get('announceDaysBefore') as string

      return updateEventAction(event.id, {
        title: formData.get('title') as string,
        summary: (formData.get('summary') as string) || null,
        description: (formData.get('description') as string) || null,
        category: formData.get('category') as EventCategory,
        visibility: formData.get('visibility') as EventVisibility,
        status: formData.get('status') as EventStatus,
        allDay,
        startAt: new Date(formData.get('startAt') as string),
        endAt: endAtValue ? new Date(endAtValue) : null,
        location: (formData.get('location') as string) || null,
        announceDaysBefore: announceDaysValue ? Number(announceDaysValue) : null,
      })
    },
    { successKey: 'success.updated' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-event-title">{t('fields.title')}</Label>
            <Input
              id="edit-event-title"
              name="title"
              required
              maxLength={120}
              defaultValue={event.title}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-event-category">{t('fields.category')}</Label>
              <Select
                id="edit-event-category"
                name="category"
                defaultValue={event.category}
                required
                disabled={isPending}
              >
                {EVENT_CATEGORY_VALUES.map((category) => (
                  <option key={category} value={category}>
                    {tCategory(category)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-event-visibility">{t('fields.visibility')}</Label>
              <Select
                id="edit-event-visibility"
                name="visibility"
                defaultValue={event.visibility}
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
          <div className="space-y-2">
            <Label htmlFor="edit-event-status">{t('fields.status')}</Label>
            <Select
              id="edit-event-status"
              name="status"
              defaultValue={event.status}
              disabled={isPending}
            >
              {EVENT_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {tStatus(status)}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-graphite">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded border-alabaster"
            />
            {t('fields.allDay')}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-event-start-at">{t('fields.startAt')}</Label>
              <Input
                id="edit-event-start-at"
                name="startAt"
                type={allDay ? 'date' : 'datetime-local'}
                defaultValue={toInputDateValue(event.startAt, allDay)}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-event-end-at">{t('fields.endAt')}</Label>
              <Input
                id="edit-event-end-at"
                name="endAt"
                type={allDay ? 'date' : 'datetime-local'}
                defaultValue={event.endAt ? toInputDateValue(event.endAt, allDay) : undefined}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-event-location">{t('fields.location')}</Label>
            <Input
              id="edit-event-location"
              name="location"
              maxLength={250}
              defaultValue={event.location ?? undefined}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-event-summary">{t('fields.summary')}</Label>
            <Input
              id="edit-event-summary"
              name="summary"
              maxLength={280}
              defaultValue={event.summary ?? undefined}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-event-description">{t('fields.description')}</Label>
            <Textarea
              id="edit-event-description"
              name="description"
              defaultValue={event.description ?? undefined}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-event-announce-days">{t('fields.announceDays')}</Label>
            <Input
              id="edit-event-announce-days"
              name="announceDaysBefore"
              type="number"
              min="0"
              step="1"
              defaultValue={event.announceDaysBefore ?? undefined}
              disabled={isPending}
            />
            <p className="text-xs text-graphite-600">{t('fields.announceDaysHint')}</p>
          </div>
          <div className="space-y-2 border-t border-alabaster-700 pt-4">
            <Label>{t('fields.images')}</Label>
            <EventImagesField eventId={event.id} images={event.images} />
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={tEdit} isPending={isPending} onCancel={close} />
    </form>
  )
}
