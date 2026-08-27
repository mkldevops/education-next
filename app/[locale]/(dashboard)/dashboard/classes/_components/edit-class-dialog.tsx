'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast, toastActionError } from '@/lib/toast'
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
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateClassPeriodAction(classItem.id, {
        name: formData.get('name') as string,
        capacity: Number(formData.get('capacity')),
      })
      if (typeof result === 'string') {
        toastActionError(t, result)
      } else {
        toast.success(t('success'))
        setOpen(false)
      }
    })
  }

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
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t('submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
