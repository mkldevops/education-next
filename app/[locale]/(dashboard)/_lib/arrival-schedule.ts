import {
  owedPlanAmount,
  type PaymentInstallment,
  type PaymentSchedule,
  paymentInstallments,
} from '@/domain/payment-schedule'
import { roundHalfUp } from '@/lib/decimal'
import type { ClassOption } from './class-options'

/**
 * Échéancier d'une inscription à créer, tel que le formulaire le montre avant l'envoi. Calcul
 * d'affichage seulement, sur les règles du domaine : le serveur revalide le mois de début et le
 * montant du premier mois, puis recalcule le total.
 */

type ArrivalPlan = { amount?: number; paymentSchedule?: PaymentSchedule }

export type ArrivalPeriod = { startAt: string; endAt: string }

export type ArrivalSchedule = {
  /** Mois d'échéance de la formule dans la période (`YYYY-MM`), premier mois à payer possibles. */
  months: string[]
  /** Mois retenu : celui demandé s'il porte une échéance, sinon le premier de la formule. */
  startMonth: string
  /** Le mois retenu est la première échéance : l'inscription court sur toute la période. */
  fullPeriod: boolean
  /** Aujourd'hui dépasse la première échéance : l'arrivée en cours d'année est probable. */
  pastFirstDue: boolean
  /** Seule une formule mensuelle accepte un montant réduit pour le premier mois. */
  monthly: boolean
  /** Échéance de la formule au mois retenu, plafond du montant du premier mois. */
  nominal: number
  /** Part de la formule due à partir du mois retenu, premier mois réduit compris. */
  owed: number
  installments: PaymentInstallment[]
}

/** Période de la classe choisie ; sans classe, la période commune à toutes les classes proposées. */
export function arrivalPeriod(
  classes: ClassOption[],
  classPeriodId: string | null
): ArrivalPeriod | null {
  const selected = classes.find((option) => option.id === classPeriodId)
  const candidates = selected ? [selected] : classes
  const [first] = candidates
  if (!first?.periodStartAt || !first.periodEndAt) return null
  const shared = candidates.every(
    (option) =>
      option.periodStartAt === first.periodStartAt && option.periodEndAt === first.periodEndAt
  )
  return shared ? { startAt: first.periodStartAt, endAt: first.periodEndAt } : null
}

/** Montant saisi du premier mois : un champ vide ou illisible ne réduit rien. */
export function parseFirstAmount(value: string): number | null {
  if (value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

export function arrivalSchedule(
  plan: ArrivalPlan | undefined,
  period: ArrivalPeriod | null,
  currency: string,
  {
    startMonth,
    firstAmount,
    totalAmount,
    today,
  }: { startMonth: string; firstAmount: string; totalAmount?: number; today: string }
): ArrivalSchedule | null {
  if (!plan?.paymentSchedule || plan.amount === undefined || !period) return null
  const schedule = plan.paymentSchedule
  const periodStart = new Date(period.startAt)
  const all = paymentInstallments(schedule, plan.amount, periodStart, currency)
  if (all.length === 0) return null

  const periodMonths = { from: period.startAt.slice(0, 7), to: period.endAt.slice(0, 7) }
  const months = [...new Set(all.map((installment) => installment.dueDate.slice(0, 7)))].filter(
    (month) => month >= periodMonths.from && month <= periodMonths.to
  )
  if (months.length === 0) return null

  const month = months.includes(startMonth) ? startMonth : months[0]
  const owedInstallments = all.filter((installment) => installment.dueDate >= `${month}-01`)
  const nominal = owedInstallments[0].amount
  const monthly = schedule.mode === 'MONTHLY'
  const typed = monthly ? parseFirstAmount(firstAmount) : null
  const first = typed !== null && typed > 0 && typed <= nominal ? typed : null
  const owed = roundHalfUp(
    owedInstallments.reduce((sum, installment) => sum + installment.amount, 0) -
      nominal +
      (first ?? nominal)
  )

  return {
    months,
    startMonth: month,
    fullPeriod: month === all[0].dueDate.slice(0, 7),
    pastFirstDue: today > all[0].dueDate,
    monthly,
    nominal,
    owed,
    installments: paymentInstallments(schedule, totalAmount ?? owed, periodStart, currency, {
      startMonth: month,
      firstInstallmentAmount: first,
    }),
  }
}

/**
 * Ce que le formulaire envoie : pas de mois de début pour une inscription sur toute la période
 * sans premier mois réduit, pour qu'elle se crée comme une inscription ordinaire.
 */
export function arrivalInput(
  schedule: ArrivalSchedule | null,
  firstAmount: string
): { startMonth: string | null; firstInstallmentAmount: number | null } {
  if (!schedule) return { startMonth: null, firstInstallmentAmount: null }
  const firstInstallmentAmount = schedule.monthly ? parseFirstAmount(firstAmount) : null
  return {
    startMonth: schedule.fullPeriod && firstInstallmentAmount === null ? null : schedule.startMonth,
    firstInstallmentAmount,
  }
}

/** Date locale du navigateur (`YYYY-MM-DD`), comparée aux échéances pour déplier la section. */
export function localToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Ce qu'il faut d'une inscription existante pour montrer son échéancier avant et après. */
export type EnrollmentScheduleBasis = {
  planAmount: number
  paymentSchedule: PaymentSchedule
  /** Début de la période de l'inscription (ISO). */
  periodStartAt: string
  totalAmount: number
  startMonth: string | null
  firstInstallmentAmount: number | null
}

export type StartMonthPreview = {
  previous: PaymentInstallment[]
  installments: PaymentInstallment[]
  /** Échéance de la formule au premier mois dû, plafond du montant du premier mois. */
  nominal: number
}

/**
 * Échéancier d'une inscription avant et après la correction de son mois de début. Même règle
 * que `setEnrollmentStartMonth` : le total devient la part de la formule due à partir du mois,
 * premier mois réduit et remise déduits. Un montant hors bornes n'est pas compté ici, le
 * serveur le refuse à l'enregistrement.
 */
export function startMonthPreview(
  basis: EnrollmentScheduleBasis,
  currency: string,
  next: { startMonth: string | null; firstAmount: string; discount: number }
): StartMonthPreview | null {
  const schedule = basis.paymentSchedule
  const periodStart = new Date(basis.periodStartAt)
  const plan = paymentInstallments(schedule, basis.planAmount, periodStart, currency)
  const owedInstallments = plan.filter(
    (installment) => !next.startMonth || installment.dueDate >= `${next.startMonth}-01`
  )
  if (owedInstallments.length === 0) return null

  const nominal = owedInstallments[0].amount
  const typed = next.startMonth ? parseFirstAmount(next.firstAmount) : null
  const reduced = owedPlanAmount(basis.planAmount, schedule, periodStart, currency, {
    startMonth: next.startMonth,
    firstInstallmentAmount: typed,
  })
  const first = typeof reduced === 'number' ? typed : null
  const owed =
    typeof reduced === 'number'
      ? reduced
      : owedPlanAmount(basis.planAmount, schedule, periodStart, currency, {
          startMonth: next.startMonth,
        })
  if (typeof owed !== 'number') return null

  return {
    previous: paymentInstallments(schedule, basis.totalAmount, periodStart, currency, {
      startMonth: basis.startMonth,
      firstInstallmentAmount: basis.firstInstallmentAmount,
    }),
    installments: paymentInstallments(
      schedule,
      Math.max(0, roundHalfUp(owed - next.discount)),
      periodStart,
      currency,
      { startMonth: next.startMonth, firstInstallmentAmount: first }
    ),
    nominal,
  }
}
