'use client'

import {
  Button,
  Dialog,
  DialogContentLoading,
  DialogRouteOpener,
  DialogTrigger,
  DialogWhenOpen,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import type { PayableEnrollmentChoice } from '@/use-cases/payments/payable-enrollment-choices'

// Le formulaire de règlement ne se charge qu'à l'ouverture du dialogue.
const RecordPaymentDialogContent = dynamic(
  () =>
    import('./record-payment-dialog-content').then((module) => module.RecordPaymentDialogContent),
  { loading: () => <DialogContentLoading /> }
)

interface Option {
  id: string
  name: string
}

export function RecordPaymentDialog({
  families,
  defaultOpen = false,
  redirectTo = '/dashboard/payments',
  showTrigger = true,
  remainingAmount,
  currency,
  trigger,
  canOpenCashier = false,
  enrollments = [],
}: {
  families: Option[]
  currency: string
  /** Inscriptions à régler de l'unique famille, pour porter le règlement sur un seul enfant. */
  enrollments?: PayableEnrollmentChoice[]
  canOpenCashier?: boolean
  defaultOpen?: boolean
  redirectTo?: string
  showTrigger?: boolean
  remainingAmount?: number
  /** Bouton d'ouverture à la place du bouton principal, pour un point d'entrée secondaire. */
  trigger?: ReactNode
}) {
  const t = useTranslations('dashboard.pages.payments.record')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo} />
      {showTrigger && (
        <DialogTrigger>
          {trigger ?? (
            <Button>
              <Plus className="h-4 w-4" />
              {t('title')}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogWhenOpen>
        <RecordPaymentDialogContent
          families={families}
          remainingAmount={remainingAmount}
          currency={currency}
          canOpenCashier={canOpenCashier}
          enrollments={enrollments}
        />
      </DialogWhenOpen>
    </Dialog>
  )
}
