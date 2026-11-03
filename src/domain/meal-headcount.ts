import { weekdayOf } from './meal-ledger'

type Segment = {
  accountId: string
  /** `null` pour un élève ; pour le personnel, exempté ou non. */
  staff: { exempt: boolean } | null
  weekdays: readonly number[]
  startOn: string
  endOn: string | null
  periodEnd: string
}

export type MealHeadcount = { students: number; staff: number; staffFree: number }

/**
 * Repas servis un jour, élèves et personnel séparés (#545). Chaque titulaire compte une fois
 * par compte dont un segment sert ce jour, sauf absence. Un jour fermé ne sert personne.
 */
export function mealHeadcount(input: {
  day: string
  isClosed: boolean
  segments: readonly Segment[]
  absentAccountIds: ReadonlySet<string>
}): MealHeadcount {
  if (input.isClosed) return { students: 0, staff: 0, staffFree: 0 }
  const weekday = weekdayOf(input.day)
  const { day } = input

  const served = new Map<string, Segment['staff']>()
  for (const segment of input.segments) {
    const last =
      segment.endOn !== null && segment.endOn < segment.periodEnd
        ? segment.endOn
        : segment.periodEnd
    if (segment.startOn > day || last < day) continue
    if (!segment.weekdays.includes(weekday)) continue
    if (input.absentAccountIds.has(segment.accountId)) continue
    served.set(segment.accountId, segment.staff)
  }

  const owners = [...served.values()]
  const staff = owners.filter((owner) => owner !== null)
  return {
    students: owners.length - staff.length,
    staff: staff.length,
    staffFree: staff.filter((owner) => owner.exempt).length,
  }
}
