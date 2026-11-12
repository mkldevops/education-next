import type { PaymentTrackingState } from '@/domain/payment-tracking-state'

export const PAYMENT_TRACKING_BADGE_TONE: Record<PaymentTrackingState, string> = {
  late: 'border-red-200 bg-red-50 text-red-800',
  due: 'border-sky-200 bg-sky-50 text-sky-800',
  ahead: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  upToDate: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  settled: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  untracked: 'border-alabaster-500 bg-alabaster-900 text-graphite-600',
}
