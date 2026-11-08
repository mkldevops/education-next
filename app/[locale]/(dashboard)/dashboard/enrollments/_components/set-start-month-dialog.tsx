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
import { useRouter } from '@/i18n/routing'
import { setEnrollmentStartMonthAction } from '../../../_lib/enrollment-actions'

export interface StartMonthSetting {
  /** `YYYY-MM`, or `null` when the enrollment owes from its period start. */
  value: string | null
  /** Months of the enrollment's period, `YYYY-MM`. */
  min?: string
  max?: string
}

interface SetStartMonthDialogProps {
  enrollmentId: string
  startMonth: StartMonthSetting
}

export function SetStartMonthDialog({ enrollmentId, startMonth }: SetStartMonthDialogProps) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.setStartMonth')

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
        <StartMonthForm enrollmentId={enrollmentId} startMonth={startMonth} />
      </DialogContent>
    </Dialog>
  )
}

function StartMonthForm({ enrollmentId, startMonth }: SetStartMonthDialogProps) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.setStartMonth')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()

  const handleSubmit = onSubmit(
    (formData) =>
      setEnrollmentStartMonthAction({
        enrollmentId,
        startMonth: String(formData.get('startMonth') ?? '') || null,
      }),
    { onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-2">
          <Label htmlFor="enrollment-start-month">{t('label')}</Label>
          <Input
            id="enrollment-start-month"
            name="startMonth"
            type="month"
            min={startMonth.min}
            max={startMonth.max}
            defaultValue={startMonth.value ?? ''}
            disabled={isPending}
          />
          <p className="text-sm text-graphite-600">{t('hint')}</p>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
