import { StatusBadge } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import type {
  EnrollmentStatus,
  EventCategory,
  EventStatus,
  EventVisibility,
  PaymentMethod,
} from '@/generated/prisma/client'

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  const t = useTranslations('status')
  return <StatusBadge status={status} label={t(status)} />
}

export function PaymentMethodLabel({ method }: { method: PaymentMethod }) {
  const t = useTranslations('paymentMethod')
  return <>{t(method)}</>
}

export function EventCategoryLabel({ category }: { category: EventCategory }) {
  const t = useTranslations('eventCategory')
  return <>{t(category)}</>
}

export function EventVisibilityLabel({ visibility }: { visibility: EventVisibility }) {
  const t = useTranslations('eventVisibility')
  return <>{t(visibility)}</>
}

// `StatusBadge` ne connaît que les couleurs génériques et les statuts d'inscription :
// `EventStatus` s'y greffe via les variantes couleur plutôt que d'étendre le composant
// partagé pour un seul appelant.
const EVENT_STATUS_COLORS: Record<EventStatus, 'gray' | 'green' | 'red'> = {
  DRAFT: 'gray',
  PUBLISHED: 'green',
  CANCELLED: 'red',
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const t = useTranslations('eventStatus')
  return <StatusBadge status={EVENT_STATUS_COLORS[status]} label={t(status)} />
}
