import { resolveDebtorFamily } from '@/domain/family-debtor'
import { db } from '@/lib/db'
import { PAYABLE_ENROLLMENT_STATUSES } from './family-balance'
import { getPaymentTrackingByFamily, type TrackedFamily } from './payment-tracking'

export type OverdueStudent = {
  studentId: string
  personId: string
  name: string
  lastname: string
  classes: { id: string; name: string }[]
  family: Omit<TrackedFamily, 'familyId' | 'familyName' | 'tracked' | 'dueThisMonth'> & {
    id: string
    name: string
  }
}

/**
 * Élèves dont la famille redevable est en retard sur ses échéances.
 *
 * Le retard se mesure par famille : un versement est réparti entre frères et sœurs, et une
 * avance sur l'un couvre les échéances de l'autre. Chaque élève porte donc le retard de sa
 * famille, et seuls ceux dont une inscription payable rattache la dette à cette famille
 * apparaissent. Tri par retard décroissant, puis par nom.
 */
export async function getOverdueStudents(
  schoolId: string,
  {
    periodId,
    reference,
    tracking = getPaymentTrackingByFamily,
  }: {
    periodId?: string | null
    reference?: Date
    tracking?: typeof getPaymentTrackingByFamily
  } = {}
): Promise<OverdueStudent[]> {
  const overdue = (await tracking(schoolId, { periodId, reference })).filter(
    (family) => family.overdueAmount > 0
  )
  if (overdue.length === 0) return []
  const overdueById = new Map(overdue.map((family) => [family.familyId, family]))

  const students = await db.student.findMany({
    where: {
      schoolId,
      isActive: true,
      person: { families: { some: { familyId: { in: [...overdueById.keys()] } } } },
      enrollments: {
        some: {
          isActive: true,
          status: { in: [...PAYABLE_ENROLLMENT_STATUSES] },
          ...(periodId ? { classAssignments: { some: { classPeriod: { periodId } } } } : {}),
        },
      },
    },
    select: {
      id: true,
      person: {
        select: {
          id: true,
          name: true,
          lastname: true,
          families: { select: { familyId: true, relationType: true } },
        },
      },
      enrollments: {
        where: { isActive: true, status: { in: [...PAYABLE_ENROLLMENT_STATUSES] } },
        select: {
          classAssignments: {
            where: { endAt: null },
            select: { classPeriod: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  return students
    .flatMap((student) => {
      const debtor = resolveDebtorFamily(student.person.families)
      const family = debtor && overdueById.get(debtor.familyId)
      if (!family) return []
      return [
        {
          studentId: student.id,
          personId: student.person.id,
          name: student.person.name,
          lastname: student.person.lastname,
          classes: student.enrollments.flatMap((enrollment) =>
            enrollment.classAssignments.map((row) => row.classPeriod)
          ),
          family: {
            id: family.familyId,
            name: family.familyName,
            overdueAmount: family.overdueAmount,
            expectedToDate: family.expectedToDate,
            paidToDate: family.paidToDate,
          },
        },
      ]
    })
    .sort(
      (a, b) =>
        b.family.overdueAmount - a.family.overdueAmount ||
        a.family.name.localeCompare(b.family.name) ||
        a.lastname.localeCompare(b.lastname) ||
        a.name.localeCompare(b.name)
    )
}
