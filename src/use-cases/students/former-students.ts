import { dbArchived } from '@/lib/db'
import { roundHalfUp, toNumber } from '@/lib/decimal'

function loadFormerStudents(schoolId: string) {
  // `dbArchived` lifts the soft-delete filter only: the archived students are the point of this
  // read, the tenant guard still checks the root `schoolId`.
  return dbArchived.student.findMany({
    where: { schoolId, isActive: false },
    select: {
      id: true,
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
          endMonth: true,
          totalAmount: true,
          payments: { where: { isActive: true }, select: { amount: true } },
          classAssignments: {
            orderBy: { startAt: 'desc' },
            take: 1,
            select: {
              startAt: true,
              classPeriod: { select: { name: true, period: { select: { name: true } } } },
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
  /** Tuition still owed on the enrollments the departure closed. */
  remaining: number
}

/** Projects one archived student into the « Anciens élèves » row. */
function toFormerStudentRow(student: FormerStudentRecord): FormerStudentRow {
  const latestAssignment = student.enrollments
    .flatMap((enrollment) => enrollment.classAssignments)
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())[0]
  // The enrollments a departure closed (`archiveStudent`): `COMPLETED` with an end month. Only
  // they still owe tuition once the student is gone.
  const departed = student.enrollments.filter(
    (enrollment) => enrollment.status === 'COMPLETED' && enrollment.endMonth !== null
  )
  const lastEndMonth = departed
    .map((enrollment) => enrollment.endMonth as Date)
    .sort((a, b) => b.getTime() - a.getTime())[0]
  const remaining = departed.reduce((sum, enrollment) => {
    const paid = enrollment.payments.reduce((acc, payment) => acc + toNumber(payment.amount), 0)
    return sum + Math.max(0, toNumber(enrollment.totalAmount) - paid)
  }, 0)
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
  return (await loadFormerStudents(schoolId)).map(toFormerStudentRow)
}

/** Number of archived students of the school, for the « Anciens » toggle. */
export function countFormerStudents(schoolId: string) {
  return dbArchived.student.count({ where: { schoolId, isActive: false } })
}
