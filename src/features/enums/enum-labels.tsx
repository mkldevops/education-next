import { StatusBadge } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import type { ConfigValueType, EnrollmentStatus, PaymentMethod } from '@/generated/prisma/client'

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  const t = useTranslations('status')
  return <StatusBadge status={status} label={t(status)} />
}

export function PaymentMethodLabel({ method }: { method: PaymentMethod }) {
  const t = useTranslations('paymentMethod')
  return <>{t(method)}</>
}

export function ConfigValueTypeLabel({ valueType }: { valueType: ConfigValueType }) {
  const t = useTranslations('configValueType')
  return <>{t(valueType)}</>
}
