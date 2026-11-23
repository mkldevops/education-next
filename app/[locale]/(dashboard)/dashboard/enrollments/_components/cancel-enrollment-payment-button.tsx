'use client'

import { Button, Dialog, DialogTrigger } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { CancelPaymentDialogContent } from '../../families/[id]/_components/cancel-payment-dialog'

interface Props {
  paymentId: string
  amount: string
  isRefund: boolean
}

/**
 * Annule une seule ligne de l'inscription. L'historique famille regroupe les lignes d'un
 * même règlement réparti entre enfants : l'annuler là-bas les annulerait toutes.
 */
export function CancelEnrollmentPaymentButton({ paymentId, amount, isRefund }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails.paymentHistory.cancel')
  const router = useRouter()

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="ghost" size="sm" className="text-red-600">
          {t('trigger')}
        </Button>
      </DialogTrigger>
      <CancelPaymentDialogContent
        paymentIds={[paymentId]}
        amount={amount}
        isRefund={isRefund}
        onSuccess={() => router.refresh()}
      />
    </Dialog>
  )
}
