import { planningWeekday } from './current-week-dates'

/** Jours de service d'un enfant : jours ISO (lundi = 1) entre deux dates incluses. */
export type MealSegment = { weekdays: readonly number[]; startOn: string; endOn: string | null }

export type MealLedgerEntry =
  | { kind: 'payment'; amount: number; unitPrice: number; cancelled?: boolean }
  | { kind: 'adjustment'; days: number }

export type MealLedger = { days: number; credit: number; lastUnitPrice: number | null }

export type MealCoverage = {
  paidThrough: string | null
  coveredLeft: number
  dueDays: number
  dueAmount: number
  credit: number
  surplusValue: number
}

export type MealPaymentWarning = 'notMultiple' | 'lessThanWeek' | 'exceedsPeriod'

const DAY_MS = 86_400_000
const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

// Les montants passent en centièmes : `floor(0.3 / 0.1)` vaut 2 en flottant.
const SCALE = 100
const toHundredths = (value: number) => Math.round(value * SCALE)

export function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + DAY_MS).toISOString().slice(0, 10)
}

export function weekdayOf(day: string): number {
  return planningWeekday(new Date(`${day}T00:00:00.000Z`))
}

/** Non vide, sans doublon, inclus dans `allowed`. */
export function validateMealWeekdays(
  weekdays: readonly number[],
  allowed: readonly number[] = ISO_WEEKDAYS
): 'OK' | 'invalidWeekdays' {
  if (weekdays.length === 0 || new Set(weekdays).size !== weekdays.length) return 'invalidWeekdays'
  return weekdays.every((day) => allowed.includes(day)) ? 'OK' : 'invalidWeekdays'
}

/**
 * Jours servis triés (R3) : jours des segments jusqu'à la fin de période, moins
 * fermetures et absences. Les jours autorisés de l'école n'interviennent pas ici.
 */
export function servedDays(input: {
  segments: readonly MealSegment[]
  periodEnd: string
  isClosed: (day: string) => boolean
  absences?: ReadonlySet<string>
}): string[] {
  const days = new Set<string>()
  for (const segment of input.segments) {
    const last =
      segment.endOn !== null && segment.endOn < input.periodEnd ? segment.endOn : input.periodEnd
    for (let day = segment.startOn; day <= last; day = nextDay(day)) {
      if (!segment.weekdays.includes(weekdayOf(day))) continue
      if (input.isClosed(day) || input.absences?.has(day)) continue
      days.add(day)
    }
  }
  return [...days].sort()
}

/** Nombre de jours servis jusqu'à `day` inclus : convertit « déjà payé jusqu'au » (R10). */
export function servedDaysThrough(served: readonly string[], day: string): number {
  return served.filter((served) => served <= day).length
}

type LedgerState = { days: number; credit: number }

function applyPayment(state: LedgerState, amount: number, unitPrice: number): LedgerState {
  const price = toHundredths(unitPrice)
  const credit = state.credit + toHundredths(amount)
  return { days: state.days + Math.floor(credit / price), credit: credit % price }
}

/** Rejoue les écritures actives dans l'ordre reçu (R1, R8). */
export function replayLedger(entries: readonly MealLedgerEntry[]): MealLedger {
  let state: LedgerState = { days: 0, credit: 0 }
  let lastUnitPrice: number | null = null
  for (const entry of entries) {
    if (entry.kind === 'adjustment') {
      state = { ...state, days: state.days + entry.days }
    } else if (!entry.cancelled) {
      state = applyPayment(state, entry.amount, entry.unitPrice)
      lastUnitPrice = entry.unitPrice
    }
  }
  return { days: state.days, credit: state.credit / SCALE, lastUnitPrice }
}

/**
 * Couverture d'un compte (R2, R4, R5, R11). `unitPrice` est le tarif du jour :
 * payer `dueAmount` à ce tarif ramène exactement `dueDays` à zéro.
 */
export function computeCoverage(input: {
  served: readonly string[]
  ledger: MealLedger
  today: string
  unitPrice: number
}): MealCoverage {
  const { served, ledger, today } = input
  const owned = Math.max(0, ledger.days)
  const covered = served.slice(0, owned)
  const dueDays = Math.max(0, servedDaysThrough(served, today) - owned)
  const due = toHundredths(input.unitPrice) * dueDays - toHundredths(ledger.credit)
  const surplusDays = Math.max(0, owned - served.length)
  const surplus =
    surplusDays * toHundredths(ledger.lastUnitPrice ?? input.unitPrice) +
    (owned >= served.length ? toHundredths(ledger.credit) : 0)

  return {
    paidThrough: covered.at(-1) ?? null,
    coveredLeft: covered.filter((day) => day >= today).length,
    dueDays,
    dueAmount: Math.max(0, due) / SCALE,
    credit: ledger.credit,
    surplusValue: surplus / SCALE,
  }
}

/** Effet d'un encaissement avant validation (R9). */
export function previewMealPayment(input: {
  served: readonly string[]
  ledger: MealLedger
  amount: number
  unitPrice: number
  daysPerWeek: number
}): {
  daysAdded: number
  newPaidThrough: string | null
  remainder: number
  warnings: MealPaymentWarning[]
} {
  const before = { days: input.ledger.days, credit: toHundredths(input.ledger.credit) }
  const after = applyPayment(before, input.amount, input.unitPrice)
  const daysAdded = after.days - before.days
  const owned = Math.max(0, after.days)
  const warnings: MealPaymentWarning[] = []
  if (after.credit > 0) warnings.push('notMultiple')
  if (daysAdded < input.daysPerWeek) warnings.push('lessThanWeek')
  if (owned > input.served.length) warnings.push('exceedsPeriod')

  return {
    daysAdded,
    newPaidThrough: input.served[Math.min(owned, input.served.length) - 1] ?? null,
    remainder: after.credit / SCALE,
    warnings,
  }
}

/** Montant à encaisser pour acheter `days` jours au tarif du jour, crédit déduit. */
export function amountForDays(days: number, unitPrice: number, credit: number): number {
  return Math.max(0, toHundredths(unitPrice) * days - toHundredths(credit)) / SCALE
}
