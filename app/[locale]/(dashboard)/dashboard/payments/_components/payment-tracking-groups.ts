import type { TrackedFamilyDetail } from '@/use-cases/payments/payment-tracking'
import type { Horizon } from '../../_components/remaining-horizon-switch'

export type TrackingFamily = TrackedFamilyDetail & { contactPhone: string | null }

export type BoardFamily = TrackingFamily & {
  amount: number
  remainingYear: number
  advance: number
}

export type GroupKey = 'late' | 'due' | 'clear' | 'remaining' | 'settled'

export type TrackingGroupData = { key: GroupKey; families: BoardFamily[]; amount: number }

const MONTH_GROUPS: GroupKey[] = ['late', 'due', 'clear']
const YEAR_GROUPS: GroupKey[] = ['late', 'remaining', 'settled']

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

function toBoardFamily(family: TrackingFamily, horizon: Horizon): BoardFamily {
  const remainingYear = Math.max(0, family.annualAmount - family.creditedPaid)
  return {
    ...family,
    remainingYear,
    advance: Math.max(0, family.creditedPaid - family.expectedToDate),
    amount: horizon === 'month' ? family.dueThisMonth : remainingYear,
  }
}

function groupOf(family: BoardFamily, horizon: Horizon): GroupKey {
  if (family.overdueAmount > 0) return 'late'
  if (horizon === 'month') return family.dueThisMonth > 0 ? 'due' : 'clear'
  return family.remainingYear > 0 ? 'remaining' : 'settled'
}

const byAmountThenName = (a: BoardFamily, b: BoardFamily) =>
  b.amount - a.amount || a.familyName.localeCompare(b.familyName)

/**
 * Month: families with a schedule, grouped by what they owe by the end of the month.
 * Year: families with an annual amount, grouped by what is left on their year.
 */
export function groupFamilies(families: TrackingFamily[], horizon: Horizon, query = '') {
  const scope = families
    .filter((family) => (horizon === 'month' ? family.tracked : family.annualAmount > 0))
    .map((family) => toBoardFamily(family, horizon))
  const keys = horizon === 'month' ? MONTH_GROUPS : YEAR_GROUPS
  const clearKey: GroupKey = horizon === 'month' ? 'clear' : 'settled'
  const needle = normalize(query)

  const groups: TrackingGroupData[] = keys.map((key) => {
    const members = scope.filter((family) => groupOf(family, horizon) === key)
    return {
      key,
      amount: members.reduce((sum, family) => sum + family.amount, 0),
      families: members
        .filter((family) => !needle || normalize(family.familyName).includes(needle))
        .sort(byAmountThenName),
    }
  })

  return {
    groups,
    total: scope.reduce((sum, family) => sum + family.amount, 0),
    settledCount: scope.filter((family) => groupOf(family, horizon) === clearKey).length,
    scopeCount: scope.length,
  }
}
