import { weekdayOf } from './meal-ledger'

type StudentSegment = {
  accountId: string
  weekdays: readonly number[]
  startOn: string
  endOn: string | null
  periodEnd: string
}

type StaffRhythm = { weekdays: readonly number[]; isFree: boolean }

export type MealHeadcount = { students: number; staff: number; staffFree: number }

/**
 * Repas servis un jour, élèves et personnel séparés (#545). Un élève compte une fois par
 * compte dont un segment sert ce jour, sauf absence ; un membre du personnel compte si le jour
 * est un des siens. Un jour fermé ne sert personne.
 */
export function mealHeadcount(input: {
  day: string
  isClosed: boolean
  segments: readonly StudentSegment[]
  absentAccountIds: ReadonlySet<string>
  staff: readonly StaffRhythm[]
}): MealHeadcount {
  if (input.isClosed) return { students: 0, staff: 0, staffFree: 0 }
  const weekday = weekdayOf(input.day)
  const { day } = input

  const served = new Set<string>()
  for (const segment of input.segments) {
    const last =
      segment.endOn !== null && segment.endOn < segment.periodEnd
        ? segment.endOn
        : segment.periodEnd
    if (segment.startOn > day || last < day) continue
    if (!segment.weekdays.includes(weekday)) continue
    if (input.absentAccountIds.has(segment.accountId)) continue
    served.add(segment.accountId)
  }

  const eating = input.staff.filter((member) => member.weekdays.includes(weekday))
  return {
    students: served.size,
    staff: eating.length,
    staffFree: eating.filter((member) => member.isFree).length,
  }
}
