import { SEAT_HOLDING_ENROLLMENT_STATUSES } from '@/domain/class-period'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { suggestLevelId } from './class-options'

/**
 * Projection Prisma d'une classe pour le sélecteur partagé : niveau, capacité et places
 * occupées, au prédicat d'occupation commun (`seatHoldingAssignmentsWhere`).
 */
export const classOptionSelect = {
  id: true,
  name: true,
  capacity: true,
  levelId: true,
  level: { select: { name: true } },
  _count: {
    select: {
      classAssignments: {
        where: {
          endAt: null,
          enrollment: { status: { in: [...SEAT_HOLDING_ENROLLMENT_STATUSES] } },
        },
      },
    },
  },
} satisfies Prisma.ClassPeriodSelect

type ClassOptionRow = Prisma.ClassPeriodGetPayload<{ select: typeof classOptionSelect }>

export function toClassOption(row: ClassOptionRow, name: string = row.name) {
  return {
    id: row.id,
    name,
    levelId: row.levelId,
    levelName: row.level.name,
    capacity: row.capacity,
    enrolled: row._count.classAssignments,
  }
}

/**
 * Niveau suggéré par élève pour la période cible, depuis sa dernière affectation d'une
 * inscription non annulée. Un élève sans historique n'a pas d'entrée.
 */
export async function loadSuggestedLevels(
  schoolId: string,
  studentIds: string[],
  targetPeriodId: string | null
): Promise<Map<string, string>> {
  const suggestions = new Map<string, string>()
  if (studentIds.length === 0) return suggestions

  const assignments = await db.classAssignment.findMany({
    where: {
      schoolId,
      enrollment: { studentId: { in: studentIds }, status: { not: 'CANCELLED' } },
    },
    select: {
      enrollment: { select: { studentId: true } },
      classPeriod: {
        select: {
          periodId: true,
          levelId: true,
          level: { select: { nextLevels: { select: { nextLevelId: true } } } },
        },
      },
    },
    orderBy: { startAt: 'desc' },
  })

  for (const { enrollment, classPeriod } of assignments) {
    if (suggestions.has(enrollment.studentId)) continue
    const levelId = suggestLevelId(
      {
        levelId: classPeriod.levelId,
        nextLevelIds: classPeriod.level.nextLevels.map(({ nextLevelId }) => nextLevelId),
        periodId: classPeriod.periodId,
      },
      targetPeriodId
    )
    if (levelId) suggestions.set(enrollment.studentId, levelId)
  }

  return suggestions
}
