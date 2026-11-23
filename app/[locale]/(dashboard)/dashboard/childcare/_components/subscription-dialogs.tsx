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
import { useId } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import {
  removeChildcareSubscriptionAction,
  saveChildcareSubscriptionAction,
} from '../../../_lib/childcare-actions'
import { MONTH_PATTERN, RateField, type Subscription } from './childcare-form-fields'

export function EditSubscriptionDialog({
  subscription,
  rates,
}: {
  subscription: Subscription
  rates: number[]
}) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('form.edit')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('form.editTitle', { name: subscription.name })}</DialogTitle>
        </DialogHeader>
        <EditSubscriptionForm subscription={subscription} rates={rates} />
      </DialogContent>
    </Dialog>
  )
}

function EditSubscriptionForm({
  subscription,
  rates,
}: {
  subscription: Subscription
  rates: number[]
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const id = useId()
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit(
    (formData) =>
      saveChildcareSubscriptionAction({
        studentId: subscription.studentId,
        monthlyAmount: Number(formData.get('monthlyAmount')),
        startMonth: formData.get('startMonth') as string,
        endMonth: subscription.endMonth,
      }),
    { successKey: 'form.success' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <RateField
            id={`${id}-amount`}
            rates={rates}
            defaultValue={subscription.monthlyAmount}
            disabled={isPending}
          />
          <p className="text-xs text-graphite-600">{t('form.rateHint')}</p>
          <div className="space-y-2">
            <Label htmlFor={`${id}-start`}>{t('form.startMonth')}</Label>
            <Input
              id={`${id}-start`}
              name="startMonth"
              type="month"
              pattern={MONTH_PATTERN}
              defaultValue={subscription.startMonth}
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

export function StopSubscriptionDialog({
  subscription,
  earliestEnd,
  lastBilledLabel,
  remaining,
}: {
  subscription: Subscription
  earliestEnd: string
  lastBilledLabel: string | null
  remaining: string | null
}) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="text-red-700">
          {t('stop.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('stop.title', { name: subscription.name })}</DialogTitle>
        </DialogHeader>
        <StopSubscriptionForm
          subscription={subscription}
          earliestEnd={earliestEnd}
          lastBilledLabel={lastBilledLabel}
          remaining={remaining}
        />
      </DialogContent>
    </Dialog>
  )
}

function StopSubscriptionForm({
  subscription,
  earliestEnd,
  lastBilledLabel,
  remaining,
}: {
  subscription: Subscription
  earliestEnd: string
  lastBilledLabel: string | null
  remaining: string | null
}) {
  const t = useTranslations('dashboard.pages.childcare')
  const id = useId()
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit(
    (formData) =>
      saveChildcareSubscriptionAction({
        studentId: subscription.studentId,
        monthlyAmount: subscription.monthlyAmount,
        startMonth: subscription.startMonth,
        endMonth: formData.get('endMonth') as string,
      }),
    { successKey: 'stop.success' }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-end`}>{t('stop.lastMonth')}</Label>
            <Input
              id={`${id}-end`}
              name="endMonth"
              type="month"
              pattern={MONTH_PATTERN}
              min={earliestEnd}
              defaultValue={earliestEnd}
              required
              disabled={isPending}
            />
            <p className="text-xs text-graphite-600">
              {lastBilledLabel
                ? t('stop.lastBilled', { month: lastBilledLabel })
                : t('stop.noBill')}
            </p>
          </div>
          {remaining && (
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {t('stop.stillDue', { amount: remaining })}
            </p>
          )}
          <p className="text-xs text-graphite-600">{t('stop.resumeHint')}</p>
        </div>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitKey="stop.submit"
        submitVariant="destructive"
      />
    </form>
  )
}

export function ResumeSubscriptionDialog({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('resume.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('resume.title', { name: subscription.name })}</DialogTitle>
        </DialogHeader>
        <ResumeSubscriptionForm subscription={subscription} />
      </DialogContent>
    </Dialog>
  )
}

function ResumeSubscriptionForm({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('dashboard.pages.childcare')
  const { isPending, close, onSubmit } = useDialogForm(t)
  return (
    <form
      onSubmit={onSubmit(
        () =>
          saveChildcareSubscriptionAction({
            studentId: subscription.studentId,
            monthlyAmount: subscription.monthlyAmount,
            startMonth: subscription.startMonth,
            endMonth: null,
          }),
        { successKey: 'resume.success' }
      )}
    >
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('resume.description')}</p>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} submitKey="resume.submit" />
    </form>
  )
}

export function RemoveSubscriptionDialog({ studentId }: { studentId: string }) {
  const t = useTranslations('dashboard.pages.childcare')
  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="ghost" size="sm" className="text-graphite-600">
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
