'use client'

import { Button } from '@peaklab/ui'
import { HandCoins, Phone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { RecordPaymentDialog } from './record-payment-dialog'

interface Props {
  family: { id: string; name: string }
  phone: string | null
}

/** Actions d'une famille à relancer : l'appeler, ou saisir son règlement sans quitter la page. */
export function OutstandingFamilyActions({ family, phone }: Props) {
  const t = useTranslations('dashboard.pages.payments.stats')
  const tRecord = useTranslations('dashboard.pages.payments.record')

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      {phone ? (
        <a
          href={`tel:${phone.replace(/[^+\d]/g, '')}`}
          aria-label={t('callFamily', { family: family.name })}
          className="flex w-fit items-center gap-1 text-xs text-primary hover:text-primary-hover hover:underline"
        >
          <Phone className="h-3 w-3 shrink-0" />
          {phone}
        </a>
      ) : (
        <span className="text-xs text-graphite-600">{t('noPhone')}</span>
      )}
      <RecordPaymentDialog
        families={[family]}
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
