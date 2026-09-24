import { checkCapacity, SEAT_HOLDING_ENROLLMENT_STATUSES } from '@/domain/class-period'
import type { Prisma } from '@/generated/prisma/client'

export type SeatReservation = 'OK' | 'notFound' | 'classFull'

/** Places occupées d'une classe : affectation ouverte d'une inscription qui tient sa place. */
export function seatHoldingAssignmentsWhere(
  schoolId: string,
  classPeriodId: string
): Prisma.ClassAssignmentWhereInput {
  return {
    schoolId,
    classPeriodId,
    endAt: null,
    enrollment: { status: { in: [...SEAT_HOLDING_ENROLLMENT_STATUSES] } },
  }
}

/**
 * Réserve `seats` places dans une classe, sous verrou, jusqu'à la fin de `tx`.
 *
 * `SELECT … FOR UPDATE` sur la ligne `ClassPeriod` (portée par `schoolId`) sérialise toutes les
 * écritures qui prennent une place dans cette classe : la transaction suivante attend le commit
 * de celle-ci, puis recompte et voit la place prise. Sans verrou, deux transactions READ
 * COMMITTED comptent chacune N−1 et remplissent la classe à N+1.
 *
 * À appeler avant l'écriture de l'affectation, et à consommer par un refus qui n'écrit rien :
 * le verrou n'a de sens que si le comptage et l'insertion partagent la même transaction.
 */
export async function reserveClassSeats(
  tx: Prisma.TransactionClient,
  schoolId: string,
  classPeriodId: string,
  seats = 1
): Promise<SeatReservation> {
  const rows = await tx.$queryRaw<Array<{ capacity: number }>>`
    SELECT "capacity" FROM "ClassPeriod"
    WHERE "id" = ${classPeriodId} AND "schoolId" = ${schoolId} AND "isActive" = true
    FOR UPDATE`
  const classPeriod = rows[0]
  if (!classPeriod) return 'notFound'

  const occupied = await tx.classAssignment.count({
    where: seatHoldingAssignmentsWhere(schoolId, classPeriodId),
  })

  // `checkCapacity` répond pour une place : on lui présente la classe une fois les premières
  // places prises, donc `seats - 1` en plus.
  return checkCapacity(classPeriod.capacity, occupied + seats - 1)
}

/**
 * Réserve des places dans plusieurs classes. Les verrous sont pris par identifiant croissant :
 * deux transactions qui visent les mêmes classes dans un ordre différent ne s'interbloquent pas.
 */
export async function reserveClassSeatsInOrder(
  tx: Prisma.TransactionClient,
  schoolId: string,
  seatsByClassPeriodId: Map<string, number>
): Promise<SeatReservation> {
  const classPeriodIds = [...seatsByClassPeriodId.keys()].sort()
  for (const classPeriodId of classPeriodIds) {
    const seats = seatsByClassPeriodId.get(classPeriodId) ?? 0
    const reservation = await reserveClassSeats(tx, schoolId, classPeriodId, seats)
    if (reservation !== 'OK') return reservation
  }
  return 'OK'
}
