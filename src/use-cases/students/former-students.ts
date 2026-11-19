import { readPaymentSchedule, startMonthFromDate } from '@/domain/payment-schedule'
import { legacyDepartureMonth, legacyDepartureTotal } from '@/domain/student-departure'
import { dbArchived } from '@/lib/db'
import { roundHalfUp, toNumber } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'

function loadFormerStudents(schoolId: string) {
  // `dbArchived` lifts the soft-delete filter only: the archived students are the point of this
  // read, the tenant guard still checks the root `schoolId`.
  return dbArchived.student.findMany({
    where: { schoolId, isActive: false },
    select: {
      id: true,
      isActive: true,
      leftAt: true,
      formerClassLabel: true,
      person: {
        select: {
          name: true,
          lastname: true,
          families: {
            where: { family: { isActive: true } },
            select: { familyId: true, family: { select: { name: true } } },
          },
        },
      },
      enrollments: {
        where: { isActive: true },
        select: {
          status: true,
          startMonth: true,
          endMonth: true,
          totalAmount: true,
          plan: { select: { paymentSchedule: true } },
          payments: { where: { isActive: true }, select: { amount: true } },
          classAssignments: {
            orderBy: { startAt: 'desc' },
            take: 1,
            select: {
              startAt: true,
              classPeriod: {
                select: { name: true, period: { select: { name: true, startAt: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: [{ leftAt: { sort: 'desc', nulls: 'last' } }, { person: { lastname: 'asc' } }],
  })
}

type FormerStudentRecord = Awaited<ReturnType<typeof loadFormerStudents>>[number]

export type FormerStudentRow = {
  id: string
  name: string
  family: { id: string; name: string } | null
  /**
   * Class and period of the latest class assignment, whichever enrollment carried it; for a
   * student imported without enrollment, the class label read from the list (no period).
   */
  lastClass: { name: string; period: string | null } | null
  /** Departure date, or the last month owed when the archive predates `leftAt`. */
  leftAt: Date | null
  /** Tuition still owed on the enrollments the departure closed, or left open before `leftAt`. */
  remaining: number
}

/**
 * Tuition an enrollment still owes once its student left. A departure through `archiveStudent`
 * closed it `COMPLETED` with an end month and a cut total. An older archive left it open, uncut:
 * it owes what was due through the month of `leftAt`, as `archiveStudent` would have kept.
 */
function owedAfterDeparture(
  student: FormerStudentRecord,
  enrollment: FormerStudentRecord['enrollments'][number],
  { currency, timeZone }: { currency: string; timeZone: string }
): number {
  const paid = enrollment.payments.reduce((acc, payment) => acc + toNumber(payment.amount), 0)
  const departureMonth = legacyDepartureMonth(student, enrollment, timeZone)
  if (departureMonth) {
    const total = legacyDepartureTotal(
      {
        schedule: readPaymentSchedule(enrollment.plan.paymentSchedule),
        totalAmount: toNumber(enrollment.totalAmount),
        periodStart: enrollment.classAssignments[0]?.classPeriod.period.startAt ?? null,
        startMonth: startMonthFromDate(enrollment.startMonth),
      },
      departureMonth,
      paid,
      currency
    )
    return Math.max(0, total - paid)
  }
  if (enrollment.status !== 'COMPLETED' || enrollment.endMonth === null) return 0
  return Math.max(0, toNumber(enrollment.totalAmount) - paid)
}

/** Projects one archived student into the « Anciens élèves » row. */
function toFormerStudentRow(
  student: FormerStudentRecord,
  regional: { currency: string; timeZone: string }
): FormerStudentRow {
  const latestAssignment = student.enrollments
    .flatMap((enrollment) => enrollment.classAssignments)
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())[0]
  const lastEndMonth = student.enrollments
    .flatMap((enrollment) =>
      enrollment.status === 'COMPLETED' && enrollment.endMonth ? [enrollment.endMonth] : []
    )
    .sort((a, b) => b.getTime() - a.getTime())[0]
  const remaining = student.enrollments.reduce(
    (sum, enrollment) => sum + owedAfterDeparture(student, enrollment, regional),
    0
  )
  const link = student.person.families[0]

  return {
    id: student.id,
    name: `${student.person.name} ${student.person.lastname}`,
    family: link ? { id: link.familyId, name: link.family.name } : null,
    lastClass: latestAssignment
      ? {
          name: latestAssignment.classPeriod.name,
          period: latestAssignment.classPeriod.period.name,
        }
      : student.formerClassLabel
        ? { name: student.formerClassLabel, period: null }
        : null,
    leftAt: student.leftAt ?? lastEndMonth ?? null,
    remaining: roundHalfUp(remaining),
  }
}

/** Archived students of the school, most recent departures first. Staff only. */
export async function listFormerStudents(schoolId: string): Promise<FormerStudentRow[]> {
  const [students, regional] = await Promise.all([
    loadFormerStudents(schoolId),
    getSchoolRegionalSettings(schoolId),
  ])
  return students.map((student) => toFormerStudentRow(student, regional))
}

/** Number of archived students of the school, for the « Anciens » toggle. */
export function countFormerStudents(schoolId: string) {
  return dbArchived.student.count({ where: { schoolId, isActive: false } })
}
