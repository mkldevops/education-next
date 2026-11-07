'use client'

import { Button, Dialog, useDialog, useMenu } from '@peaklab/ui'
import type { LucideIcon } from 'lucide-react'
import { Ban, FileText, MoreHorizontal, ReceiptText, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { issueReceiptForPaymentsAction } from '../../../../_lib/payment-actions'
import { CancelPaymentDialogContent } from './cancel-payment-dialog'

type Props = {
  paymentIds: string[]
  receiptId: string | null
  isOnline: boolean
  amount: string
  isRefund: boolean
}

type MenuItem = {
  key: string
  label: string
  icon: LucideIcon
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
}

/**
 * Actions d'une ligne de l'historique : un paiement avec reçu se consulte et s'annule depuis son
 * reçu, une saisie manuelle sans reçu peut en recevoir un ou être annulée, un paiement en ligne se
 * rembourse chez Stripe. Le serveur applique la même règle.
 */
export function PaymentRowMenu(props: Props) {
  return (
    <Dialog>
      <PaymentRowDropdown {...props} />
      {!props.receiptId && !props.isOnline && (
        <CancelPaymentDialogContent
          paymentIds={props.paymentIds}
          amount={props.amount}
          isRefund={props.isRefund}
        />
      )}
    </Dialog>
  )
}

function PaymentRowDropdown({ paymentIds, receiptId, isOnline, isRefund }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails.paymentHistory')
  const tIssue = useTranslations('dashboard.pages.familyDetails.paymentHistory.issueReceipt')
  const router = useRouter()
  const { setOpen } = useDialog()
  const { open, close, toggle, containerRef, triggerRef, menuRef } = useMenu()
  const [isIssuing, setIssuing] = useState(false)

  const receiptHref = receiptId ? `/dashboard/cashier/receipts/${receiptId}` : null

  const issueReceipt = async () => {
    setIssuing(true)
    const result = await issueReceiptForPaymentsAction(paymentIds)
    if (typeof result === 'string') {
      setIssuing(false)
      toastActionError(tIssue, result)
      return
    }
    toast.success(tIssue('success'))
    router.push(`/dashboard/cashier/receipts/${result.receiptId}`)
  }

  const items: MenuItem[] = []
  if (receiptHref) {
    items.push({
      key: 'view',
      label: t('viewReceipt'),
      icon: FileText,
      onSelect: () => router.push(receiptHref),
    })
    if (!isOnline) {
      items.push({
        key: 'cancelReceipt',
        label: t('cancelReceipt'),
        icon: XCircle,
        danger: true,
        onSelect: () => router.push(`${receiptHref}?action=cancel`),
      })
    }
  }
  if (isOnline) {
    items.push({ key: 'online', label: t('cancel.onlineHint'), icon: Ban, disabled: true })
  } else if (!receiptId) {
    if (!isRefund) {
      items.push({
        key: 'issue',
        label: tIssue('trigger'),
        icon: ReceiptText,
        disabled: isIssuing,
        onSelect: issueReceipt,
      })
    }
    items.push({
      key: 'cancel',
      label: t('cancel.trigger'),
      icon: XCircle,
      danger: true,
      onSelect: () => setOpen(true),
    })
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <Button
        ref={triggerRef}
        size="sm"
        variant="ghost"
        className="w-8 px-0"
        aria-label={t('actions')}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isIssuing}
        onClick={toggle}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-64 rounded border border-alabaster-700 bg-white py-1 shadow-lg"
        >
          {items.map(({ key, label, icon: Icon, onSelect, danger, disabled }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                close(false)
                onSelect?.()
              }}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                disabled && 'cursor-not-allowed text-graphite-700',
                !disabled && !danger && 'text-graphite hover:bg-alabaster-900',
                !disabled && danger && 'text-red-600 hover:bg-red-50'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', danger && !disabled && 'text-red-500')} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
