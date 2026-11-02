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
  removeChildcareSubscriptionAction,
  saveChildcareSubscriptionAction,
} from '../../../_lib/childcare-actions'

const MONTH_PATTERN = '\\d{4}-\\d{2}'

type Subscription = {
  monthlyAmount: number
  startMonth: string
  endMonth: string | null
}

/** Ouverture ou modification : aucun tarif ni début n'est proposé d'avance. */
export function SubscriptionDialog({
  studentId,
  studentName,
  subscription,
}: {
  studentId: string
  studentName: string
  subscription?: Subscription
}) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t(subscription ? 'form.edit' : 'form.add')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{studentName}</DialogTitle>
        </DialogHeader>
        <SubscriptionForm studentId={studentId} subscription={subscription} />
      </DialogContent>
    </Dialog>
  )
}

function SubscriptionForm({
  studentId,
  subscription,
}: {
  studentId: string
  subscription?: Subscription
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const id = `childcare-${studentId}`

  const handleSubmit = onSubmit(
    (formData) =>
      saveChildcareSubscriptionAction({
        studentId,
        monthlyAmount: Number(formData.get('monthlyAmount')),
        startMonth: formData.get('startMonth') as string,
        endMonth: (formData.get('endMonth') as string) || null,
      }),
    { successKey: 'form.success' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-amount`}>{t('form.monthlyAmount')}</Label>
            <Input
              id={`${id}-amount`}
              name="monthlyAmount"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              defaultValue={subscription?.monthlyAmount}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-start`}>{t('form.startMonth')}</Label>
            <Input
              id={`${id}-start`}
              name="startMonth"
              type="month"
              pattern={MONTH_PATTERN}
              defaultValue={subscription?.startMonth}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-end`}>{t('form.endMonth')}</Label>
            <Input
              id={`${id}-end`}
              name="endMonth"
              type="month"
              pattern={MONTH_PATTERN}
              defaultValue={subscription?.endMonth ?? undefined}
              disabled={isPending}
            />
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}

export function BillMonthDialog() {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button>{t('bill.trigger')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('bill.title')}</DialogTitle>
        </DialogHeader>
        <BillMonthForm />
      </DialogContent>
    </Dialog>
  )
}

function BillMonthForm() {
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
        <Button variant="outline" size="sm">
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

export function RemoveSubscriptionDialog({ studentId }: { studentId: string }) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('remove.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('remove.title')}</DialogTitle>
        </DialogHeader>
        <RemoveSubscriptionForm studentId={studentId} />
      </DialogContent>
    </Dialog>
  )
}

function RemoveSubscriptionForm({ studentId }: { studentId: string }) {
  const t = useTranslations('dashboard.pages.childcare')
  const { isPending, close, onSubmit } = useDialogForm(t)

  return (
    <form
      onSubmit={onSubmit(() => removeChildcareSubscriptionAction(studentId), {
        successKey: 'remove.success',
      })}
    >
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('remove.description')}</p>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitKey="remove.submit"
        submitVariant="destructive"
      />
    </form>
  )
}
