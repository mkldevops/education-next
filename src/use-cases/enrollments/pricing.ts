import { calculateTotalAmount, pricingFromTotalAmount, validateDiscount } from '@/domain/enrollment'
import {
  type FirstInstallmentError,
  firstInstallmentFitsTotal,
  owedPlanAmount,
  readPaymentSchedule,
  startMonthFromDate,
  startMonthToDate,
  validateStartMonth,
} from '@/domain/payment-schedule'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
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
  | FirstInstallmentError

/** Arrivée en cours d'année : le mois de début et, s'il est réduit, le montant du premier mois. */
type Arrival = {
  startMonth: Date | string | null | undefined
  firstInstallmentAmount?: number | null
}

/**
 * Le prix de formule qu'une inscription doit réellement : la formule entière sans mois de
 * début, ses seules échéances à partir de ce mois sinon. Il remplace le prix de la formule
 * dans toute règle de total (remise, montant saisi, changement de formule), pour qu'une
 * inscription arrivée en cours d'année ne retrouve pas en silence son total plein.
 *
 * Un premier mois réduit remplace l'échéance de la formule à ce mois : il exige un mois de
 * début, une formule mensuelle et un montant compris dans cette échéance.
 *
 * Sans mois de début, aucune lecture : une inscription existante se calcule comme avant.
 */
export async function resolveOwedPlanAmount(
  schoolId: string,
  enrollmentId: string,
  plan: PricedPlan,
  { startMonth, firstInstallmentAmount = null }: Arrival
): Promise<OwedPlanAmount> {
  const month = typeof startMonth === 'string' ? startMonth : startMonthFromDate(startMonth)
  if (!month) {
    return firstInstallmentAmount === null
      ? Number(plan.amount)
      : 'firstInstallmentRequiresStartMonth'
  }
  const period = await enrollmentGateway.findPeriodBounds(schoolId, enrollmentId)
  if (!period) return 'notFound'
  return owedForPeriod(schoolId, plan, period, { startMonth: month, firstInstallmentAmount })
}

/** Même calcul quand la période est déjà connue, pour une inscription pas encore créée. */
export async function owedForPeriod(
  schoolId: string,
  plan: PricedPlan,
  period: { startAt: Date; endAt: Date },
  {
    startMonth,
    firstInstallmentAmount = null,
  }: { startMonth: string; firstInstallmentAmount?: number | null }
): Promise<OwedPlanAmount> {
  const check = validateStartMonth(startMonth, period)
  if (check !== 'OK') return check
  const { currency } = await getSchoolRegionalSettings(schoolId)
  return owedPlanAmount(
    Number(plan.amount),
    readPaymentSchedule(plan.paymentSchedule),
    period.startAt,
    currency,
    { startMonth, firstInstallmentAmount }
  )
}

/**
 * Arrivée en cours d'année d'une inscription à créer. Avec un mois de début, elle emporte la
 * période de la classe et la devise, lues avant la transaction de création.
 */
export type NewEnrollmentArrival =
  | { startMonth: null; firstInstallmentAmount: number | null }
  | {
      startMonth: string
      firstInstallmentAmount: number | null
      period: { startAt: Date; endAt: Date }
      currency: string
    }

/** Aucune lecture sans mois de début : une inscription sur l'année entière se crée comme avant. */
export async function loadNewEnrollmentArrival(
  schoolId: string,
  classPeriodId: string,
  {
    startMonth,
    firstInstallmentAmount,
  }: { startMonth: string | null; firstInstallmentAmount: number | null }
): Promise<NewEnrollmentArrival | 'notFound'> {
  if (!startMonth) return { startMonth: null, firstInstallmentAmount }
  const period = await classPeriodGateway.findPeriodBounds(schoolId, classPeriodId)
  if (!period) return 'notFound'
  const { currency } = await getSchoolRegionalSettings(schoolId)
  return { startMonth, firstInstallmentAmount, period, currency }
}

/**
 * Tarif d'une inscription à créer : mêmes règles que la correction d'une inscription
 * existante. La part de la formule due à partir du mois de début porte la remise et le
 * total saisi ; le premier mois réduit doit tenir dans ce total.
 */
export function priceNewEnrollment(
  plan: PricedPlan,
  arrival: NewEnrollmentArrival,
  { discount, totalAmount }: { discount: number; totalAmount?: number }
) {
  const planAmountDue =
    arrival.startMonth === null
      ? arrival.firstInstallmentAmount === null
        ? Number(plan.amount)
        : ('firstInstallmentRequiresStartMonth' as const)
      : validateStartMonth(arrival.startMonth, arrival.period) === 'OK'
        ? owedPlanAmount(
            Number(plan.amount),
            readPaymentSchedule(plan.paymentSchedule),
            arrival.period.startAt,
            arrival.currency,
            arrival
          )
        : ('startMonthOutsidePeriod' as const)
  if (typeof planAmountDue === 'string') return planAmountDue

  const pricing = resolveEnrollmentPricing(planAmountDue, discount, totalAmount)
  if (typeof pricing === 'string') return pricing
  if (!firstInstallmentFitsTotal(arrival.firstInstallmentAmount, pricing.totalAmount)) {
    return 'firstInstallmentExceedsTotal' as const
  }
  return {
    ...pricing,
    startMonth: arrival.startMonth === null ? null : startMonthToDate(arrival.startMonth),
    firstInstallmentAmount: arrival.firstInstallmentAmount,
  }
}
