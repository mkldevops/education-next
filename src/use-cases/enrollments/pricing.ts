import { calculateTotalAmount, pricingFromTotalAmount, validateDiscount } from '@/domain/enrollment'
import {
  owedPlanAmount,
  readPaymentSchedule,
  startMonthFromDate,
  validateStartMonth,
} from '@/domain/payment-schedule'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'

export function resolveEnrollmentPricing(
  planAmount: number,
  discount: number,
  totalAmount?: number
) {
  if (totalAmount !== undefined) return pricingFromTotalAmount(planAmount, totalAmount)
  const check = validateDiscount(planAmount, discount)
  if (check !== 'OK') return check
  return { discount, totalAmount: calculateTotalAmount(planAmount, discount) }
}

type PricedPlan = { amount: unknown; paymentSchedule: unknown }

export type OwedPlanAmount =
  | number
  | 'notFound'
  | 'startMonthOutsidePeriod'
  | 'noPaymentSchedule'
  | 'noInstallmentDue'

/**
 * Le prix de formule qu'une inscription doit réellement : la formule entière sans mois de
 * début, ses seules échéances à partir de ce mois sinon. Il remplace le prix de la formule
 * dans toute règle de total (remise, montant saisi, changement de formule), pour qu'une
 * inscription arrivée en cours d'année ne retrouve pas en silence son total plein.
 *
 * Sans mois de début, aucune lecture : une inscription existante se calcule comme avant.
 */
export async function resolveOwedPlanAmount(
  schoolId: string,
  enrollmentId: string,
  plan: PricedPlan,
  startMonth: Date | string | null | undefined
): Promise<OwedPlanAmount> {
  const month = typeof startMonth === 'string' ? startMonth : startMonthFromDate(startMonth)
  if (!month) return Number(plan.amount)
  const period = await enrollmentGateway.findPeriodBounds(schoolId, enrollmentId)
  if (!period) return 'notFound'
  return owedForPeriod(schoolId, plan, period, month)
}

/** Même calcul quand la période est déjà connue, pour une inscription pas encore créée. */
export async function owedForPeriod(
  schoolId: string,
  plan: PricedPlan,
  period: { startAt: Date; endAt: Date },
  startMonth: string
): Promise<OwedPlanAmount> {
  const check = validateStartMonth(startMonth, period)
  if (check !== 'OK') return check
  const { currency } = await getSchoolRegionalSettings(schoolId)
  return owedPlanAmount(
    Number(plan.amount),
    readPaymentSchedule(plan.paymentSchedule),
    period.startAt,
    currency,
    startMonth
  )
}
