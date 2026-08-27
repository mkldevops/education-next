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
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { updateClassPeriodAction } from '../../../_lib/class-period-actions'

interface EditClassDialogProps {
  classItem: {
    id: string
    name: string
    capacity: number
  }
}

export function EditClassDialog({ classItem }: EditClassDialogProps) {
  const t = useTranslations('dashboard.pages.classes.edit')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditClassForm classItem={classItem} />
      </DialogContent>
    </Dialog>
  )
}

function EditClassForm({ classItem }: EditClassDialogProps) {
  const t = useTranslations('dashboard.pages.classes.edit')
  const tCreate = useTranslations('dashboard.pages.classes.create')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    updateClassPeriodAction(classItem.id, {
      name: formData.get('name') as string,
      capacity: Number(formData.get('capacity')),
    })
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-class-name">{tCreate('name')}</Label>
            <Input
              id="edit-class-name"
              name="name"
              defaultValue={classItem.name}
              required
              maxLength={250}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-class-capacity">{tCreate('capacity')}</Label>
            <Input
              id="edit-class-capacity"
              name="capacity"
              type="number"
              min={1}
              defaultValue={classItem.capacity}
              required
              disabled={isPending}
            />
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
