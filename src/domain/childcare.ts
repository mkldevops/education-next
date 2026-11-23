/** Mois de garderie `YYYY-MM`. En base : le 1er du mois, en `@db.Date`. */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export const isChildcareMonth = (month: string) => MONTH.test(month)

export const monthToDate = (month: string) => new Date(`${month}-01T00:00:00.000Z`)

export const dateToMonth = (date: Date) => date.toISOString().slice(0, 7)

/** Mois courant d'un jour `YYYY-MM-DD` de l'école. */
export const monthOfDay = (day: string) => day.slice(0, 7)

/** Libellé d'un mois, calculé en UTC pour rester sur le mois stocké. */
export const formatChildcareMonth = (month: string, locale: string) =>
  monthToDate(month).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

const roundCents = (value: number) => Math.round(value * 100) / 100

export type ChildcareRange = { startMonth: string; endMonth: string | null }

export function coversMonth(range: ChildcareRange, month: string) {
  return month >= range.startMonth && (range.endMonth === null || month <= range.endMonth)
}

/** Une fin avant le début ne désigne aucun mois. */
export function isValidRange(range: ChildcareRange) {
  return range.endMonth === null || range.endMonth >= range.startMonth
}

/** Reste dû sur un mois facturé, jamais négatif. */
export function chargeRemaining(amount: number, paid: number) {
  return Math.max(0, roundCents(amount - paid))
}

/** Un mois au plus tard égal à la reprise a été réglé avant l'application. */
export function settledByOpening(month: string, openingPaidThrough: string | null) {
  return openingPaidThrough !== null && month <= openingPaidThrough
}

type ChargeState = { amount: number; paid: number; settled?: boolean }

/** Reste dû d'un mois : rien sur un mois réglé par la reprise, quoi qu'aient payé ses reçus. */
export function chargeLeft(charge: ChargeState) {
  return charge.settled ? 0 : chargeRemaining(charge.amount, charge.paid)
}

/** Réglé sur un mois : la reprise le solde entier, sans créer d'encaissement. */
function chargeSettled(charge: ChargeState) {
  return charge.settled ? Math.max(charge.amount, charge.paid) : charge.paid
}

/** Une ligne de reçu ne peut pas dépasser ce qui reste dû sur son mois. */
export function exceedsCharge(amount: number, remaining: number) {
  return Math.round(amount * 100) > Math.round(remaining * 100)
}

type ExistingCharge = { id: string; subscriptionId: string; cancelledAt: Date | null }

/**
 * Facturation d'un mois : un mois déjà facturé ne bouge pas, un mois annulé repart au tarif
 * courant, un enfant hors de sa période n'est pas facturé. Le rejeu ne produit donc rien.
 */
export function planChildcareBilling<
  Subscription extends ChildcareRange & { id: string; monthlyAmount: number },
>(input: {
  month: string
  subscriptions: readonly Subscription[]
  charges: readonly ExistingCharge[]
}) {
  const inRange = input.subscriptions.filter((row) => coversMonth(row, input.month))
  const toCreate: Array<{ subscriptionId: string; amount: number }> = []
  const toRevive: Array<{ id: string; amount: number }> = []
  for (const subscription of inRange) {
    const charge = input.charges.find((row) => row.subscriptionId === subscription.id)
    if (!charge) {
      toCreate.push({ subscriptionId: subscription.id, amount: subscription.monthlyAmount })
    } else if (charge.cancelledAt) {
      toRevive.push({ id: charge.id, amount: subscription.monthlyAmount })
    }
  }
  return {
    toCreate,
    toRevive,
    alreadyBilled: inRange.length - toCreate.length - toRevive.length,
    outsideRange: input.subscriptions.length - inRange.length,
  }
}

/** Totaux d'un enfant : un mois annulé ne compte plus. */
export function summarizeChildcare(charges: ReadonlyArray<ChargeState & { cancelled: boolean }>) {
  const live = charges.filter((charge) => !charge.cancelled)
  return {
    billed: roundCents(live.reduce((sum, charge) => sum + charge.amount, 0)),
    paid: roundCents(live.reduce((sum, charge) => sum + chargeSettled(charge), 0)),
    remaining: roundCents(live.reduce((sum, charge) => sum + chargeLeft(charge), 0)),
  }
}

export type ChildcareStatus = 'stopped' | 'late' | 'due' | 'new' | 'upToDate'

/**
 * État d'un enfant à l'écran : arrêté quand sa période finit avant le mois courant, sinon
 * selon ses mois encore dus. Un enfant jamais facturé est nouveau.
 */
export function childcareStatus(
  row: {
    endMonth: string | null
    charges: ReadonlyArray<ChargeState & { cancelled: boolean }>
  },
  currentMonth: string
): { status: ChildcareStatus; dueMonths: number } {
  const live = row.charges.filter((charge) => !charge.cancelled)
  const dueMonths = live.filter((charge) => chargeLeft(charge) > 0).length
  if (row.endMonth !== null && row.endMonth < currentMonth) return { status: 'stopped', dueMonths }
  if (dueMonths >= 2) return { status: 'late', dueMonths }
  if (dueMonths === 1) return { status: 'due', dueMonths }
  if (live.length === 0) return { status: 'new', dueMonths }
  return { status: 'upToDate', dueMonths }
}

/** Dernier mois qu'un arrêt peut retenir sans exclure un mois facturé. */
export function earliestEndMonth(
  charges: ReadonlyArray<{ month: string; cancelled: boolean }>,
  startMonth: string
) {
  return charges.reduce(
    (latest, charge) => (!charge.cancelled && charge.month > latest ? charge.month : latest),
    startMonth
  )
}
