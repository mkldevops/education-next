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
import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import type { Event, EventCategory, EventStatus, EventVisibility } from '@/generated/prisma/client'
import { parseEventInputValue, toEventInputValue } from '@/lib/date'
import { updateEventAction } from '../../../_lib/event-actions'
import {
  EVENT_CATEGORY_VALUES,
  EVENT_STATUS_VALUES,
  EVENT_VISIBILITY_VALUES,
} from './event-enum-values'

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
>

type Props = {
  event: EditableEvent
}

type EditEventDialogProps = Props & {
  /** `menuitem` quand le déclencheur est une entrée de menu, pour la navigation au clavier. */
  triggerRole?: React.AriaRole
  /** Cible de repli du focus quand le déclencheur est devenu inaccessible à la fermeture. */
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

export function EditEventDialog({ event, triggerRole, restoreFocusRef }: EditEventDialogProps) {
  const tEdit = useTranslations('dashboard.pages.events.edit')

  return (
    <Dialog restoreFocusRef={restoreFocusRef}>
      <DialogTrigger>
        <Button variant="outline" size="sm" role={triggerRole}>
          <Pencil className="h-4 w-4" />
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
  const [startAt, setStartAt] = useState(() => toEventInputValue(event.startAt, event.allDay))
  const [endAt, setEndAt] = useState(() =>
    event.endAt ? toEventInputValue(event.endAt, event.allDay) : ''
  )

  const handleSubmit = onSubmit(
    (formData) => {
      const announceDaysValue = formData.get('announceDaysBefore') as string

      return updateEventAction(event.id, {
        title: formData.get('title') as string,
        summary: (formData.get('summary') as string) || null,
        description: (formData.get('description') as string) || null,
        category: formData.get('category') as EventCategory,
        visibility: formData.get('visibility') as EventVisibility,
        status: formData.get('status') as EventStatus,
        allDay,
        startAt: parseEventInputValue(startAt),
        endAt: endAt ? parseEventInputValue(endAt) : null,
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
              onChange={(e) => {
                const nextAllDay = e.target.checked
                setAllDay(nextAllDay)
                // La valeur affichée n'est pas valide pour le nouveau type : sans conversion
                // explicite, un changement de `type` vide le champ au lieu de le repositionner.
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
              <Label htmlFor="edit-event-start-at">{t('fields.startAt')}</Label>
              <Input
                id="edit-event-start-at"
                name="startAt"
                type={allDay ? 'date' : 'datetime-local'}
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
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
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
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
        </div>
      </DialogBody>
      <DialogFormActions t={tEdit} isPending={isPending} onCancel={close} />
    </form>
  )
}
