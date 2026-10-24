/** Segment enregistré d'un compte repas. `endOn` nul : jusqu'à la fin de sa période. */
export type StoredMealSegment = { id: string; startOn: string; endOn: string | null }

export type MealStopPlan = {
  removed: string[]
  closed: Array<{ id: string; endOn: string }>
}

const DAY_MS = 86_400_000

export function previousDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - DAY_MS).toISOString().slice(0, 10)
}

/** Un segment commence et finit dans sa période (R6). */
export function validateSegmentDates(input: {
  startOn: string
  endOn: string | null
  periodStart: string
  periodEnd: string
}): 'OK' | 'outsidePeriod' {
  const { startOn, endOn, periodStart, periodEnd } = input
  if (startOn < periodStart || startOn > periodEnd) return 'outsidePeriod'
  if (endOn !== null && (endOn < startOn || endOn > periodEnd)) return 'outsidePeriod'
  return 'OK'
}

function overlaps(a: Omit<StoredMealSegment, 'id'>, b: Omit<StoredMealSegment, 'id'>) {
  return (a.endOn === null || b.startOn <= a.endOn) && (b.endOn === null || a.startOn <= b.endOn)
}

/** Deux segments d'un même compte ne se chevauchent jamais : un jour n'a qu'un rythme. */
export function overlapsAny(
  segments: readonly StoredMealSegment[],
  candidate: Omit<StoredMealSegment, 'id'>
): boolean {
  return segments.some((segment) => overlaps(segment, candidate))
}

/** Le segment qui sert `day`, ou à défaut le prochain à commencer. */
export function segmentFrom<T extends StoredMealSegment>(
  segments: readonly T[],
  day: string
): T | null {
  const current = segments.find(
    (segment) => segment.startOn <= day && (segment.endOn === null || segment.endOn >= day)
  )
  if (current) return current
  return (
    [...segments]
      .filter((s) => s.startOn > day)
      .sort((a, b) => (a.startOn < b.startOn ? -1 : 1))[0] ?? null
  )
}

/**
 * Plus aucun jour servi à partir de `from` inclus : un segment déjà commencé se ferme la
 * veille, un segment qui n'a pas encore commencé disparaît. Le passé n'est jamais réécrit.
 */
export function planStop(segments: readonly StoredMealSegment[], from: string): MealStopPlan {
  const plan: MealStopPlan = { removed: [], closed: [] }
  for (const segment of segments) {
    if (segment.endOn !== null && segment.endOn < from) continue
    if (segment.startOn >= from) plan.removed.push(segment.id)
    else plan.closed.push({ id: segment.id, endOn: previousDay(from) })
  }
  return plan
}
