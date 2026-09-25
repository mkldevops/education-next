'use client'

import { Button } from '@peaklab/ui'
import { CreditCard } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { formatCurrency } from '@/lib/decimal'
import { toast } from '@/lib/toast'
import { createOnlinePaymentAction } from '../../../../_lib/online-payment-actions'

type Props = {
  amount: number
  configured: boolean
  locale: string
}

export function OnlinePaymentButton({ amount, configured, locale }: Props) {
  const t = useTranslations('dashboard.pages.familyDetails.onlinePayment')
  const [isPending, startTransition] = useTransition()

  const startPayment = () => {
    startTransition(async () => {
      const result = await createOnlinePaymentAction({ locale })
      if (typeof result === 'object' && result.result === 'OK') {
        window.location.assign(result.url)
        return
      }

      toast.error(t(errorKey(result)))
    })
  }

  if (amount <= 0) {
    return <p className="text-sm font-medium text-emerald-700">{t('settled')}</p>
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full"
        disabled={!configured || isPending}
        onClick={startPayment}
      >
        <CreditCard size={18} />
        {isPending ? t('pending') : t('action', { amount: formatCurrency(amount, locale) })}
      </Button>
      {!configured && <p className="text-xs text-amber-700">{t('unavailable')}</p>}
      <p className="text-xs text-graphite-600">{t('secure')}</p>
    </div>
  )
}

function errorKey(result: unknown) {
  if (result === 'noBalance' || result === 'paymentInProgress' || result === 'checkoutInProgress') {
    return result
  }
  return result === 'notConfigured' ? 'unavailable' : 'error'
}
