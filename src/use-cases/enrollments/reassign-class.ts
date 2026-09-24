import type { z } from 'zod'
import { OPEN_ENROLLMENT_STATUSES } from '@/domain/enrollment'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { reserveClassSeats } from '@/gateways/class-seat-lock'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import type { EnrollmentStatus } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { reassignClassSchema } from './schemas'

type Input = z.infer<typeof reassignClassSchema>

const isOpen = (status: EnrollmentStatus) =>
  (OPEN_ENROLLMENT_STATUSES as readonly EnrollmentStatus[]).includes(status)

/**
 * Change la classe d'une inscription en cours, dans sa période.
 *
 * Une inscription appartient à la période de sa classe : la déplacer vers une classe d'une autre
 * période ouvrirait une seconde inscription en cours sur cette période, facturée deux fois dans le
 * solde famille → `periodMismatch`. Tout se joue dans une transaction : verrou (école, élève,
 * période) de `createEnrollment`, ligne de l'inscription verrouillée puis relue, place réservée
 * sous verrou de classe, puis fermeture de l'affectation courante et création de la nouvelle.
 */
export async function reassignClass(input: Input) {
  const parsed = reassignClassSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, enrollmentId, newClassPeriodId } = parsed.data

  const enrollment = await enrollmentGateway.findById(schoolId, enrollmentId)
  if (!enrollment) return 'notFound' as const
  if (!isOpen(enrollment.status)) return 'invalidStatusTransition' as const

  const classPeriod = await classPeriodGateway.findById(schoolId, newClassPeriodId)
  if (!classPeriod) return 'notFound' as const
  const { periodId } = classPeriod

  return db.$transaction(async (tx) => {
    await enrollmentGateway.lockStudentInPeriod(tx, schoolId, enrollment.studentId, periodId)

    // Verrou de ligne : une annulation ou une clôture concurrente attend, ou est vue ici.
    const [locked] = await tx.$queryRaw<Array<{ status: EnrollmentStatus }>>`
      SELECT "status" FROM "Enrollment"
      WHERE "id" = ${enrollmentId} AND "schoolId" = ${schoolId} AND "isActive" = true
      FOR UPDATE`
    if (!locked) return 'notFound' as const
    if (!isOpen(locked.status)) return 'invalidStatusTransition' as const

    // La période de l'inscription est celle de son affectation ouverte, à défaut de la dernière.
    const assignments = await tx.classAssignment.findMany({
      where: { schoolId, enrollmentId },
      select: { classPeriodId: true, endAt: true, classPeriod: { select: { periodId: true } } },
      orderBy: { startAt: 'desc' },
    })
    const current = assignments.find((assignment) => assignment.endAt === null) ?? assignments[0]
    if (current && current.classPeriod.periodId !== periodId) return 'periodMismatch' as const

    // Double envoi du même formulaire : l'élève est déjà dans la classe visée.
    if (current?.endAt === null && current.classPeriodId === newClassPeriodId) return 'OK' as const

    const duplicate = await tx.enrollment.findFirst({
      where: {
        schoolId,
        studentId: enrollment.studentId,
        id: { not: enrollmentId },
        status: { in: [...OPEN_ENROLLMENT_STATUSES] },
        classAssignments: { some: { classPeriod: { periodId } } },
      },
      select: { id: true },
    })
    if (duplicate) return 'duplicateEnrollment' as const

    const seats = await reserveClassSeats(tx, schoolId, newClassPeriodId)
    if (seats !== 'OK') return seats

    await tx.classAssignment.updateMany({
      where: { schoolId, enrollmentId, endAt: null },
      data: { endAt: new Date() },
    })
    await tx.classAssignment.create({
      data: { schoolId, enrollmentId, classPeriodId: newClassPeriodId, startAt: new Date() },
    })

    return 'OK' as const
  })
}
