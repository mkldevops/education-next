import { type PaymentSchedule, readPaymentSchedule } from '@/domain/payment-schedule'
import { type DecimalLike, toNumber } from '@/lib/decimal'

/**
 * Option de formule des dialogues d'inscription, d'élève et de famille. Le prix et l'échéancier
 * ne sont fournis qu'à un administrateur d'une école qui gère les paiements : ils servent à
 * afficher les échéances d'une arrivée en cours d'année, le serveur recalcule tout.
 */
export interface PlanOption {
  id: string
  name: string
  amount?: number
  paymentSchedule?: PaymentSchedule
}

export function toPlanOption(plan: {
  id: string
  name: string
  amount: DecimalLike
  paymentSchedule: unknown
}): PlanOption {
  return {
    id: plan.id,
    name: plan.name,
    amount: toNumber(plan.amount),
    paymentSchedule: readPaymentSchedule(plan.paymentSchedule),
  }
}
