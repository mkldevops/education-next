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
} from '@peaklab/ui'
import { CopyPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { duplicateEventAction } from '../../../_lib/event-actions'

type Props = {
  eventId: string
  title: string
  nextStartLabel: string
}

export function DuplicateEventDialog({ eventId, title, nextStartLabel }: Props) {
  const tDuplicate = useTranslations('dashboard.pages.events.duplicate')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <CopyPlus className="h-4 w-4" />
          {tDuplicate('trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tDuplicate('title')}</DialogTitle>
        </DialogHeader>
        <DuplicateEventForm eventId={eventId} title={title} nextStartLabel={nextStartLabel} />
      </DialogContent>
    </Dialog>
  )
}

function DuplicateEventForm({ eventId, title, nextStartLabel }: Props) {
  const t = useTranslations('dashboard.pages.events')
  const tDuplicate = useTranslations('dashboard.pages.events.duplicate')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit(
    (formData) => duplicateEventAction(eventId, formData.get('title') as string),
    { successKey: 'success.duplicated' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <p className="text-sm text-graphite-600">
            {tDuplicate('description', { date: nextStartLabel })}
          </p>
          <div className="space-y-2">
            <Label htmlFor={`duplicate-event-title-${eventId}`}>{t('fields.title')}</Label>
            <Input
              id={`duplicate-event-title-${eventId}`}
              name="title"
              defaultValue={title}
              required
              maxLength={120}
              disabled={isPending}
            />
            <p className="text-xs text-graphite-600">{tDuplicate('titleHint')}</p>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={tDuplicate} isPending={isPending} onCancel={close} />
    </form>
  )
}
