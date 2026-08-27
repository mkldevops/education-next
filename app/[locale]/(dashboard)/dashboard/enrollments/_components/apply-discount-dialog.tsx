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
  currentDiscount: number
}

export function ApplyDiscountDialog({ enrollmentId, currentDiscount }: ApplyDiscountDialogProps) {
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
        <DiscountForm enrollmentId={enrollmentId} currentDiscount={currentDiscount} />
      </DialogContent>
    </Dialog>
  )
}

function DiscountForm({ enrollmentId, currentDiscount }: ApplyDiscountDialogProps) {
  const t = useTranslations('dashboard.pages.enrollmentDetails.applyDiscount')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()

  const handleSubmit = onSubmit(
    (formData) =>
      applyDiscountAction({
        enrollmentId,
        discount: Number(formData.get('discount')),
      }),
    { onSuccess: () => router.refresh() }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="discount-amount">{t('amount')}</Label>
            <Input
              id="discount-amount"
              name="discount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={currentDiscount}
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
