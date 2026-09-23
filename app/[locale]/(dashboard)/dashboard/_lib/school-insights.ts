import { SEAT_HOLDING_ENROLLMENT_STATUSES } from '@/domain/class-period'
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
  /** `null` quand le drapeau paiements est coupé : aucun chiffre d'encaissement à lire. */
  payments: PaymentStats | null
  classes: ClassFill[]
  levels: LevelFill[]
}

export function classFillRate(classPeriod: Pick<ClassFill, 'enrolled' | 'capacity'>): number {
  return classPeriod.capacity > 0 ? classPeriod.enrolled / classPeriod.capacity : 0
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
  periodId: string | null,
  paymentsEnabled: boolean
): Promise<SchoolInsights> {
  const [payments, classPeriods] = await Promise.all([
    paymentsEnabled ? getPaymentStats(schoolId, periodId) : Promise.resolve(null),
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
        // Même définition d'une place occupée que le contrôle de capacité de `createEnrollment`
        // et `classPeriodGateway.countEnrolled` : l'affectation encore ouverte. `ClassAssignment`
        // est un historique, et une réaffectation laisse la ligne close derrière elle : sans
        // `endAt: null`, un élève déplacé occuperait une place dans son ancienne classe comme
        // dans la nouvelle.
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
      (a, b) => classFillRate(b) - classFillRate(a) || a.name.localeCompare(b.name)
    ),
    levels: [...byLevel.entries()].map(([level, enrolled]) => ({ level, enrolled })),
  }
}
