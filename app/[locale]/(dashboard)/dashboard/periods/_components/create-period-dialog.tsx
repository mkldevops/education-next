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
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast, toastActionError } from '@/lib/toast'
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
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createPeriodAction({
        name: formData.get('name') as string,
        startAt: new Date(formData.get('startAt') as string),
        endAt: new Date(formData.get('endAt') as string),
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
