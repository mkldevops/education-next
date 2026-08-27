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
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useDialogForm } from '@/features/forms'
import { deactivatePeriodAction, updatePeriodAction } from '../../../_lib/period-actions'

interface EditPeriodDialogProps {
  period: {
    id: string
    name: string
    startAt: Date | string
    endAt: Date | string
  }
  classPeriodCount: number
}

export function EditPeriodDialog({ period, classPeriodCount }: EditPeriodDialogProps) {
  const t = useTranslations('dashboard.pages.periods.edit')

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
        <EditPeriodForm period={period} classPeriodCount={classPeriodCount} />
      </DialogContent>
    </Dialog>
  )
}

function EditPeriodForm({ period, classPeriodCount }: EditPeriodDialogProps) {
  const t = useTranslations('dashboard.pages.periods.edit')
  const tCreate = useTranslations('dashboard.pages.periods.create')
  const { isPending, close, run, onSubmit } = useDialogForm(t)

  const startStr = new Date(period.startAt).toISOString().split('T')[0]
  const endStr = new Date(period.endAt).toISOString().split('T')[0]

  const handleSubmit = onSubmit((formData) =>
    updatePeriodAction(period.id, {
      name: formData.get('name') as string,
      startAt: new Date(formData.get('startAt') as string),
      endAt: new Date(formData.get('endAt') as string),
    })
  )

  const handleArchive = () =>
    run(() => deactivatePeriodAction({ id: period.id }), { successKey: 'deleteSuccess' })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-period-name">{tCreate('name')}</Label>
            <Input
              id="edit-period-name"
              name="name"
              defaultValue={period.name}
              required
              maxLength={50}
              disabled={isPending}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-period-start">{tCreate('startDate')}</Label>
              <Input
                id="edit-period-start"
                name="startAt"
                type="date"
                defaultValue={startStr}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-period-end">{tCreate('endDate')}</Label>
              <Input
                id="edit-period-end"
                name="endAt"
                type="date"
                defaultValue={endStr}
                required
                disabled={isPending}
              />
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFooter className="justify-between">
        <Button
          type="button"
          variant="destructive"
          onClick={handleArchive}
          disabled={isPending || classPeriodCount > 0}
          title={classPeriodCount > 0 ? t('errors.periodInUse') : undefined}
        >
          {t('delete')}
        </Button>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => close()} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? '...' : t('submit')}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
