'use client'

import { useTranslations } from 'next-intl'
import { type FamilyOption, FamilyPickerDialog } from '../../_components/family-picker-dialog'
import { RecordPaymentDialog } from './record-payment-dialog'

export function RecordPaymentButton({ families }: { families: FamilyOption[] }) {
  const t = useTranslations('dashboard.pages.payments.record')

  return (
    <FamilyPickerDialog
      families={families}
      label={t('title')}
      renderDialog={(family) => (
        <RecordPaymentDialog
          families={[family]}
          defaultOpen
          showTrigger={false}
          redirectTo="/dashboard/payments"
        />
      )}
    />
  )
}
