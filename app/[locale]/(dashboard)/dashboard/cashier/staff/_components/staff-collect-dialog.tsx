'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import type { StaffReceiptData } from '../../_lib/staff-data'
import { StaffReceiptForm } from './staff-receipt-form'

type Props = {
  member: { id: string; name: string; paidThrough: string | null; dueAmount: number }
  receipt: StaffReceiptData
  /** Bouton plein quand il reste des repas dus, discret sinon. */
  highlight: boolean
  currency: string
  locale: string
}

/** Encaisse la cantine d'un membre du personnel sans quitter la liste. */
export function StaffCollectDialog({ member, receipt, highlight, currency, locale }: Props) {
  const t = useTranslations('dashboard.pages.cashier.staff')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant={highlight ? 'default' : 'outline'} size="sm">
          {t('collectShort')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('collectFor', { name: member.name })}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <StaffReceiptForm
            teacherId={member.id}
            unitPrice={receipt.unitPrice}
            served={receipt.served}
            ledger={receipt.ledger}
            paidThrough={member.paidThrough}
            dueAmount={member.dueAmount}
            daysPerWeek={receipt.daysPerWeek}
            currency={currency}
            locale={locale}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
