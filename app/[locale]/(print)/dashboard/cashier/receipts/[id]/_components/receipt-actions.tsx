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
import { Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { cancelReceiptAction } from '../../../../../../(dashboard)/_lib/receipt-actions'

/** Partage du reçu : feuille de partage du téléphone, sinon WhatsApp. */
export function ShareReceiptButton({ label, text }: { label: string; text: string }) {
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        // Partage refusé ou interrompu : le lien WhatsApp prend le relais.
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <Button size="sm" variant="outline" onClick={share}>
      <Share2 className="h-4 w-4" />
      {label}
    </Button>
  )
}

/** Annulation d'un reçu, motif obligatoire. */
export function CancelReceiptDialog({ receiptId }: { receiptId: string }) {
  const t = useTranslations('dashboard.pages.cashier.receipt.cancel')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CancelReceiptForm receiptId={receiptId} />
      </DialogContent>
    </Dialog>
  )
}

function CancelReceiptForm({ receiptId }: { receiptId: string }) {
  const t = useTranslations('dashboard.pages.cashier.receipt.cancel')
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit((formData) =>
    cancelReceiptAction(receiptId, formData.get('reason') as string)
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-2">
          <p className="text-sm text-graphite-600">{t('description')}</p>
          <Label htmlFor="receipt-cancel-reason">{t('reason')}</Label>
          <Input
            id="receipt-cancel-reason"
            name="reason"
            maxLength={250}
            required
            disabled={isPending}
          />
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} submitVariant="destructive" />
    </form>
  )
}
