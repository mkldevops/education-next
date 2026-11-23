'use client'

import {
  Button,
  Dialog,
  DialogContentLoading,
  DialogRouteOpener,
  DialogTrigger,
  DialogWhenOpen,
} from '@peaklab/ui'
import { CreditCard, Plus } from 'lucide-react'
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
  triggerLabel,
  canOpenCashier = false,
  enrollments = [],
  defaultEnrollmentId,
}: {
  families: Option[]
  currency: string
  /** Inscriptions à régler de l'unique famille, pour porter le règlement sur un seul enfant. */
  enrollments?: PayableEnrollmentChoice[]
  /** Inscription ciblée à l'ouverture, parmi `enrollments` ; à défaut, la famille entière. */
  defaultEnrollmentId?: string
  canOpenCashier?: boolean
  defaultOpen?: boolean
  redirectTo?: string
  showTrigger?: boolean
  remainingAmount?: number
  /** Bouton d'ouverture à la place du bouton principal, pour un point d'entrée secondaire. */
  trigger?: ReactNode
  /**
   * Petit bouton « encaisser » libellé ainsi. À préférer à `trigger` depuis un Server
   * Component : un élément JSX reçu du serveur n'est pas encore résolu au rendu SSR, et
   * `DialogTrigger` y rendrait un autre bouton qu'à l'hydratation.
   */
  triggerLabel?: string
}) {
  const t = useTranslations('dashboard.pages.payments.record')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo} />
      {showTrigger && (
        <DialogTrigger>
          {trigger ??
            (triggerLabel ? (
              <Button size="sm">
                <CreditCard className="h-4 w-4" />
                {triggerLabel}
              </Button>
            ) : (
              <Button>
                <Plus className="h-4 w-4" />
                {t('title')}
              </Button>
            ))}
        </DialogTrigger>
      )}
      <DialogWhenOpen>
        <RecordPaymentDialogContent
          families={families}
          remainingAmount={remainingAmount}
          currency={currency}
          canOpenCashier={canOpenCashier}
          enrollments={enrollments}
          defaultEnrollmentId={defaultEnrollmentId}
        />
      </DialogWhenOpen>
    </Dialog>
  )
}
