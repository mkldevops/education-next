'use client'

import { Button } from '@peaklab/ui'
import { HandCoins, MessageCircle, Phone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { whatsAppLink } from '@/domain/whatsapp-link'
import { RecordPaymentDialog } from './record-payment-dialog'

interface Props {
  family: { id: string; name: string }
  phone: string | null
  overdueAmount: string
  currency: string
  canOpenCashier?: boolean
}

/**
 * Actions d'une famille à relancer : l'appeler, lui écrire sur WhatsApp un message pré-rempli que
 * l'agent envoie lui-même, ou saisir son règlement sans quitter la page.
 */
export function OutstandingFamilyActions({
  family,
  phone,
  overdueAmount,
  currency,
  canOpenCashier = false,
}: Props) {
  const t = useTranslations('dashboard.pages.payments.stats')
  const tRecord = useTranslations('dashboard.pages.payments.record')
  const whatsApp = phone
    ? whatsAppLink(phone, t('whatsAppMessage', { family: family.name, amount: overdueAmount }))
    : null

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      {phone ? (
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`tel:${phone.replace(/[^+\d]/g, '')}`}
            aria-label={t('callFamily', { family: family.name })}
            className="flex w-fit items-center gap-1 text-xs text-foreground hover:underline"
          >
            <Phone className="h-3 w-3 shrink-0" />
            {phone}
          </a>
          {whatsApp && (
            <a
              href={whatsApp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('whatsAppFamily', { family: family.name })}
              className="flex w-fit items-center gap-1 text-xs text-foreground hover:underline"
            >
              <MessageCircle className="h-3 w-3 shrink-0" />
              {t('whatsApp')}
            </a>
          )}
        </div>
      ) : (
        <span className="text-xs text-graphite-600">{t('noPhone')}</span>
      )}
      <RecordPaymentDialog
        families={[family]}
        currency={currency}
        canOpenCashier={canOpenCashier}
        trigger={
          <Button size="sm" variant="outline" aria-label={t('recordFor', { family: family.name })}>
            <HandCoins className="h-3.5 w-3.5" />
            {tRecord('title')}
          </Button>
        }
      />
    </div>
  )
}
