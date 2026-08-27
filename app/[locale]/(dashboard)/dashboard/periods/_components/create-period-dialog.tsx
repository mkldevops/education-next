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
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { createPeriodAction } from '../../../_lib/period-actions'

export function CreatePeriodDialog() {
  const t = useTranslations('dashboard.pages.periods.create')

  return (
    <Dialog>
      <DialogTrigger>
        <Button>
          <Plus className="h-4 w-4" />
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreatePeriodForm />
      </DialogContent>
    </Dialog>
  )
}

function CreatePeriodForm() {
  const t = useTranslations('dashboard.pages.periods.create')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    createPeriodAction({
      name: formData.get('name') as string,
      startAt: new Date(formData.get('startAt') as string),
      endAt: new Date(formData.get('endAt') as string),
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="period-name">{t('name')}</Label>
            <Input
              id="period-name"
              name="name"
              required
              maxLength={50}
              placeholder={t('namePlaceholder')}
              disabled={isPending}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period-start">{t('startDate')}</Label>
              <Input id="period-start" name="startAt" type="date" required disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">{t('endDate')}</Label>
              <Input id="period-end" name="endAt" type="date" required disabled={isPending} />
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
