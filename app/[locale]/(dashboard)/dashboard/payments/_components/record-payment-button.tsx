'use client'

import { useTranslations } from 'next-intl'
import { type FamilyOption, FamilyPickerDialog } from '../../_components/family-picker-dialog'
import { RecordPaymentDialog } from './record-payment-dialog'

export function RecordPaymentButton({
  families,
  currency,
}: {
  families: FamilyOption[]
  currency: string
}) {
  const t = useTranslations('dashboard.pages.payments.record')

  return (
    <FamilyPickerDialog
      families={families}
      label={t('title')}
      renderDialog={(family) => (
        <RecordPaymentDialog
          families={[family]}
          currency={currency}
          defaultOpen
          showTrigger={false}
          redirectTo="/dashboard/payments"
        />
      )}
    />
  )
}
