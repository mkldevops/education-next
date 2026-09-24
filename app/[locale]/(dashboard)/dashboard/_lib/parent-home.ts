import { planningWeekday } from '@/domain/current-week-dates'
import { DAY_MS, utcStartOfDay } from '@/domain/day'
import { classScheduleGateway } from '@/gateways/class-schedule-gateway'
import { db } from '@/lib/db'
import { getFamilyBalance } from '@/use-cases/payments/family-balance'

type WeeklySlot = { weekday: number; startTime: string; endTime: string }

export type NextClass = {
  /** Minuit UTC du jour du cours, même convention que le planning. */
  date: Date
  daysAhead: number
  startTime: string
  endTime: string
}

export type ChildSummary = {
  id: string
  firstName: string
  lastName: string
  className: string | null
  levelName: string | null
  nextClass: NextClass | null
}

export type ParentHome = {
  children: ChildSummary[]
  /** `null` quand les paiements sont désactivés : aucun solde à afficher ni à régler. */
  remainingBalance: number | null
}

type ParentHomeOptions = {
  periodId: string | null
  paymentsEnabled: boolean
  scheduleEnabled: boolean
}

/** Prochaine occurrence hebdomadaire à partir du jour de `reference`, ce jour inclus. */
export function nextWeeklyOccurrence(slots: WeeklySlot[], reference: Date): NextClass | null {
  const today = utcStartOfDay(reference)
  const weekday = planningWeekday(today)
  const [next] = slots
    .map((slot) => ({ slot, daysAhead: (slot.weekday - weekday + 7) % 7 }))
    .sort((a, b) => a.daysAhead - b.daysAhead || a.slot.startTime.localeCompare(b.slot.startTime))
  if (!next) return null
  return {
    date: new Date(today.getTime() + next.daysAhead * DAY_MS),
    daysAhead: next.daysAhead,
    startTime: next.slot.startTime,
    endTime: next.slot.endTime,
  }
}

/**
 * Accueil d'un parent : ses enfants, leur classe et leur prochain cours, puis le solde de la
 * famille. Chaque lecture est bornée par `familyId`, que l'appelant tient de
 * `requireSchoolScope()` : un parent sans famille liée n'arrive jamais jusqu'ici.
 */
export async function getParentHome(
  schoolId: string,
  familyId: string,
  { periodId, paymentsEnabled, scheduleEnabled }: ParentHomeOptions,
  reference: Date = new Date()
): Promise<ParentHome> {
  const periodScope = periodId ? { classPeriod: { periodId } } : {}

  const [students, slots, balance] = await Promise.all([
    db.student.findMany({
      where: { schoolId, isActive: true, person: { families: { some: { schoolId, familyId } } } },
      select: {
        id: true,
        person: { select: { name: true, lastname: true } },
        enrollments: {
          where: {
            schoolId,
            isActive: true,
            status: { in: ['PENDING', 'ACTIVE'] },
            ...(periodId ? { classAssignments: { some: periodScope } } : {}),
          },
          select: {
            classAssignments: {
              where: { endAt: null, ...periodScope },
              select: {
                classPeriod: {
                  select: { id: true, name: true, level: { select: { name: true } } },
                },
              },
              orderBy: { startAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { registeredAt: 'desc' },
        },
      },
      orderBy: [{ person: { name: 'asc' } }, { person: { lastname: 'asc' } }],
    }),
    scheduleEnabled && periodId
      ? classScheduleGateway.listByFamilyAndPeriod(schoolId, familyId, periodId)
      : Promise.resolve([]),
    paymentsEnabled ? getFamilyBalance(schoolId, familyId) : Promise.resolve(null),
  ])

  const children = students.map<ChildSummary>((student) => {
    const classPeriod =
      student.enrollments.flatMap((enrollment) => enrollment.classAssignments)[0]?.classPeriod ??
      null
    return {
      id: student.id,
      firstName: student.person.name,
      lastName: student.person.lastname,
      className: classPeriod?.name ?? null,
      levelName: classPeriod?.level.name ?? null,
      nextClass: classPeriod
        ? nextWeeklyOccurrence(
            slots.filter((slot) => slot.classPeriodId === classPeriod.id),
            reference
          )
        : null,
    }
  })

  return { children, remainingBalance: balance?.remainingBalance ?? null }
}
