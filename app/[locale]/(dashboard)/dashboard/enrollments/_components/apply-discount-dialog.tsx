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
import { applyDiscountAction } from '../../../_lib/enrollment-actions'

interface ApplyDiscountDialogProps {
  enrollmentId: string
  currentTotalAmount: number
}

export function ApplyDiscountDialog({
  enrollmentId,
  currentTotalAmount,
}: ApplyDiscountDialogProps) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.applyDiscount')

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
        <DiscountForm enrollmentId={enrollmentId} currentTotalAmount={currentTotalAmount} />
      </DialogContent>
    </Dialog>
  )
}

function DiscountForm({ enrollmentId, currentTotalAmount }: ApplyDiscountDialogProps) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.applyDiscount')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()

  const handleSubmit = onSubmit(
    (formData) =>
      applyDiscountAction({
        enrollmentId,
        totalAmount: Number(formData.get('totalAmount')),
      }),
    { onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="discount-amount">{t('totalAmount')}</Label>
            <Input
              id="discount-amount"
              name="totalAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={currentTotalAmount}
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
