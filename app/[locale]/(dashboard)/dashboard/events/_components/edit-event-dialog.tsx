'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
} from '@peaklab/ui'
import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import type { Event, EventStatus } from '@/generated/prisma/client'
import { toEventInputValue } from '@/lib/date'
import { updateEventAction } from '../../../_lib/event-actions'
import { EVENT_STATUS_VALUES } from './event-enum-values'
import { EventFormFields, readEventFormPayload, useEventDateFields } from './event-form-fields'

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
  const tStatus = useTranslations('eventStatus')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const dates = useEventDateFields(() => ({
    allDay: event.allDay,
    startAt: toEventInputValue(event.startAt, event.allDay),
    endAt: event.endAt ? toEventInputValue(event.endAt, event.allDay) : '',
  }))

  const handleSubmit = onSubmit(
    (formData) =>
      updateEventAction(event.id, {
        ...readEventFormPayload(formData, dates),
        status: formData.get('status') as EventStatus,
      }),
    { successKey: 'success.updated' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <EventFormFields
          idPrefix="edit-event"
          defaults={{
            title: event.title,
            category: event.category,
            visibility: event.visibility,
            location: event.location ?? undefined,
            summary: event.summary ?? undefined,
            description: event.description ?? undefined,
            announceDaysBefore: event.announceDaysBefore ?? undefined,
          }}
          isPending={isPending}
          dates={dates}
          statusSlot={
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
          }
        />
      </DialogBody>
      <DialogFormActions t={tEdit} isPending={isPending} onCancel={close} />
    </form>
  )
}
