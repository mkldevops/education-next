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
import { Link2, Mail, MessageCircle, Share2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useId, useTransition } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { toast, toastActionError } from '@/lib/toast'
import {
  cancelReceiptAction,
  sendReceiptEmailAction,
} from '../../../../../../(dashboard)/_lib/receipt-actions'

/** Partage du reçu dans une modale : WhatsApp (ou la feuille de partage du téléphone), lien, e-mail. */
export function ReceiptShareDialog(props: {
  receiptId: string
  text: string
  url: string
  canEmail: boolean
}) {
  const t = useTranslations('dashboard.pages.cashier.receipt.shareMenu')

  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm" variant="outline">
          <Share2 className="h-4 w-4" />
          {t('trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <ReceiptShareOptions {...props} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function ReceiptShareOptions({
  receiptId,
  text,
  url,
  canEmail,
}: {
  receiptId: string
  text: string
  url: string
  canEmail: boolean
}) {
  const t = useTranslations('dashboard.pages.cashier.receipt.shareMenu')
  const locale = useLocale()
  const linkId = useId()
  const [isSending, startSending] = useTransition()
  const message = `${text}\n${url}`

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: message })
        return
      } catch {
        // Partage refusé ou interrompu : le lien WhatsApp prend le relais.
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('linkCopied'))
    } catch {
      toast.error(t('copyError'))
    }
  }

  const email = () =>
    startSending(async () => {
      const result = await sendReceiptEmailAction(receiptId, locale)
      if (result === 'OK') toast.success(t('emailSent'))
      else toastActionError(t, result)
    })

  const option =
    'flex w-full items-center gap-3 rounded border border-alabaster-700 px-4 py-3 text-left text-sm font-medium text-graphite transition-colors hover:bg-alabaster-900 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <div className="space-y-4">
      <p className="text-sm text-graphite-600">{t('description')}</p>
      <div className="space-y-2">
        <button type="button" className={option} onClick={share}>
          <MessageCircle className="h-5 w-5 text-emerald-600" />
          {t('whatsapp')}
        </button>
        {canEmail && (
          <button type="button" className={option} onClick={email} disabled={isSending}>
            <Mail className="h-5 w-5 text-primary" />
            {t('sendEmail')}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={linkId}>{t('link')}</Label>
        <div className="flex gap-2">
          <Input
            id={linkId}
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="font-mono text-xs"
          />
          <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
            <Link2 className="h-4 w-4" />
            {t('copyLink')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Annulation d'un reçu, motif obligatoire. */
export function CancelReceiptDialog({
  receiptId,
  initialOpen = false,
}: {
  receiptId: string
  initialOpen?: boolean
}) {
  const t = useTranslations('dashboard.pages.cashier.receipt.cancel')

  return (
    <Dialog initialOpen={initialOpen}>
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
