'use client'

import { DialogBody, DialogContent, DialogHeader, DialogTitle, Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useId } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { cancelPaymentsAction } from '../../../../_lib/payment-actions'

type Props = {
  paymentIds: string[]
  amount: string
  isRefund: boolean
}

/** Annulation d'une saisie manuelle de l'historique famille, motif facultatif. */
export function CancelPaymentDialogContent(props: Props) {
  const t = useTranslations('dashboard.pages.familyDetails.paymentHistory.cancel')

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
      </DialogHeader>
      <CancelPaymentForm {...props} />
    </DialogContent>
  )
}

function CancelPaymentForm({ paymentIds, amount, isRefund }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails.paymentHistory.cancel')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const reasonId = useId()

  const handleSubmit = onSubmit((formData) =>
    cancelPaymentsAction(paymentIds, (formData.get('reason') as string | null) ?? undefined)
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-2">
          <p className="text-sm text-graphite-600">
            {t(isRefund ? 'refundDescription' : 'description', { amount })}
          </p>
          <Label htmlFor={reasonId}>{t('reason')}</Label>
          <Input id={reasonId} name="reason" maxLength={250} disabled={isPending} />
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} submitVariant="destructive" />
    </form>
  )
}
