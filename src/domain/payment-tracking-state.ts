export type PaymentTrackingState = 'untracked' | 'settled' | 'late' | 'due' | 'ahead' | 'upToDate'

type TrackingFigures = {
  tracked: boolean
  annualAmount: number
  creditedPaid: number
  expectedToDate: number
  overdueAmount: number
  dueThisMonth: number
}

/** État d'une famille face à son échéancier, partagé par sa fiche et le suivi de l'école. */
export function paymentTrackingState(tracking: TrackingFigures): PaymentTrackingState {
  if (!tracking.tracked) return 'untracked'
  if (tracking.annualAmount > 0 && tracking.creditedPaid >= tracking.annualAmount) return 'settled'
  if (tracking.overdueAmount > 0) return 'late'
  if (tracking.dueThisMonth > 0) return 'due'
  if (tracking.creditedPaid > tracking.expectedToDate) return 'ahead'
  return 'upToDate'
}
