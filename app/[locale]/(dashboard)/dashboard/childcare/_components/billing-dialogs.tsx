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
import { toast, toastActionError } from '@/lib/toast'
import {
  billChildcareMonthAction,
  cancelChildcareChargeAction,
} from '../../../_lib/childcare-actions'
import { MONTH_PATTERN } from './childcare-form-fields'

export function BillMonthDialog({
  currentMonth,
  currentMonthLabel,
}: {
  currentMonth: string
  currentMonthLabel: string
}) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button>{t('bill.trigger', { month: currentMonthLabel })}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('bill.title')}</DialogTitle>
        </DialogHeader>
        <BillMonthForm currentMonth={currentMonth} />
      </DialogContent>
    </Dialog>
  )
}

function BillMonthForm({ currentMonth }: { currentMonth: string }) {
  const t = useTranslations('dashboard.pages.childcare')
  const { isPending, close, startTransition } = useDialogForm(t)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const month = new FormData(event.currentTarget).get('month') as string
        startTransition(async () => {
          const result = await billChildcareMonthAction(month)
          if (typeof result === 'string') {
            toastActionError(t, result)
            return
          }
          toast.success(t('bill.result', result))
          close()
        })
      }}
    >
      <DialogBody>
        <div className="space-y-2">
          <p className="text-sm text-graphite-600">{t('bill.description')}</p>
          <Label htmlFor="childcare-bill-month">{t('bill.month')}</Label>
          <Input
            id="childcare-bill-month"
            name="month"
            type="month"
            pattern={MONTH_PATTERN}
            max={currentMonth}
            defaultValue={currentMonth}
            required
            disabled={isPending}
          />
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} submitKey="bill.submit" />
    </form>
  )
}

export function CancelChargeDialog({ chargeId, month }: { chargeId: string; month: string }) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('cancelCharge.label', { month })}
          className="text-graphite-600"
        >
          {t('cancelCharge.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cancelCharge.title', { month })}</DialogTitle>
        </DialogHeader>
        <CancelChargeForm chargeId={chargeId} />
      </DialogContent>
    </Dialog>
  )
}

function CancelChargeForm({ chargeId }: { chargeId: string }) {
  const t = useTranslations('dashboard.pages.childcare')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit(
    (formData) => cancelChildcareChargeAction(chargeId, formData.get('reason') as string),
    { successKey: 'cancelCharge.success' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-2">
          <p className="text-sm text-graphite-600">{t('cancelCharge.description')}</p>
          <Label htmlFor={`childcare-cancel-${chargeId}`}>{t('cancelCharge.reason')}</Label>
          <Input
            id={`childcare-cancel-${chargeId}`}
            name="reason"
            maxLength={250}
            required
            disabled={isPending}
          />
        </div>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitKey="cancelCharge.submit"
        submitVariant="destructive"
      />
    </form>
  )
}
