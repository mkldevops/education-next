import { db } from '@/lib/db'
import { getPaymentStats, type PaymentStats } from '@/use-cases/payments/payment-stats'

export type ClassFill = {
  id: string
  name: string
  level: string
  enrolled: number
  capacity: number
}

export type LevelFill = {
  level: string
  enrolled: number
}

export type SchoolInsights = {
  payments: PaymentStats
  classes: ClassFill[]
  levels: LevelFill[]
}

/**
 * Lectures agrégées du tableau de bord administrateur : encaissements, remplissage des classes
 * et répartition des élèves par niveau, sur la période sélectionnée.
 *
 * Le remplissage compte toute affectation de la classe portée par une inscription `PENDING` ou
 * `ACTIVE`, sans filtrer `endAt` : la classe-période borne déjà l'intervalle, et les données
 * migrées renseignent systématiquement une date de fin — un filtre `endAt: null` afficherait
 * partout 0 place occupée.
 */
export async function getSchoolInsights(
  schoolId: string,
  periodId: string | null
): Promise<SchoolInsights> {
  const [payments, classPeriods] = await Promise.all([
    getPaymentStats(schoolId, periodId),
    db.classPeriod.findMany({
      where: {
        schoolId,
        isActive: true,
        ...(periodId ? { periodId } : {}),
      },
      select: {
        id: true,
        name: true,
        capacity: true,
        level: { select: { name: true } },
        _count: {
          select: {
            classAssignments: {
              where: { enrollment: { status: { in: ['PENDING', 'ACTIVE'] } } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  const classes = classPeriods.map((classPeriod) => ({
    id: classPeriod.id,
    name: classPeriod.name,
    level: classPeriod.level.name,
    enrolled: classPeriod._count.classAssignments,
    capacity: classPeriod.capacity,
  }))

  const byLevel = new Map<string, number>()
  for (const classPeriod of classes) {
    byLevel.set(classPeriod.level, (byLevel.get(classPeriod.level) ?? 0) + classPeriod.enrolled)
  }

  return {
    payments,
    classes: [...classes].sort(
      (a, b) =>
        (b.capacity > 0 ? b.enrolled / b.capacity : 0) -
          (a.capacity > 0 ? a.enrolled / a.capacity : 0) || a.name.localeCompare(b.name)
    ),
    levels: [...byLevel.entries()].map(([level, enrolled]) => ({ level, enrolled })),
  }
}
