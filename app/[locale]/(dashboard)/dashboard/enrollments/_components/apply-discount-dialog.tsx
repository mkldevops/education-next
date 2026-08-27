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
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
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
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await applyDiscountAction({
        enrollmentId,
        discount: Number(formData.get('discount')),
      })
      if (result !== 'OK') {
        toastActionError(t, result)
      } else {
        toast.success(t('success'))
        setOpen(false)
        router.refresh()
      }
    })
  }

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
