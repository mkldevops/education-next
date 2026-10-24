'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { createEventAction } from '../../../_lib/event-actions'
import { EventFormFields, readEventFormPayload, useEventDateFields } from './event-form-fields'

export function CreateEventDialog({ mealsEnabled = false }: { mealsEnabled?: boolean }) {
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
        <CreateEventForm mealsEnabled={mealsEnabled} />
      </DialogContent>
    </Dialog>
  )
}

function CreateEventForm({ mealsEnabled }: { mealsEnabled: boolean }) {
  const t = useTranslations('dashboard.pages.events')
  const tCreate = useTranslations('dashboard.pages.events.create')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const dates = useEventDateFields({ allDay: true, startAt: '', endAt: '' })

  const handleSubmit = onSubmit(
    (formData) => createEventAction(readEventFormPayload(formData, dates)),
    { successKey: 'success.created' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <EventFormFields
          idPrefix="event"
          defaults={{ visibility: 'MEMBERS' }}
          isPending={isPending}
          dates={dates}
          mealImpact={mealsEnabled ? {} : undefined}
        />
      </DialogBody>
      <DialogFormActions t={tCreate} isPending={isPending} onCancel={close} />
    </form>
  )
}
