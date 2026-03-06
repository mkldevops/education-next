import type { z } from 'zod'
import { checkCapacity } from '@/domain/class-period'
import { calculateTotalAmount } from '@/domain/enrollment'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { planGateway } from '@/gateways/plan-gateway'
import { studentGateway } from '@/gateways/student-gateway'
import { db } from '@/lib/db'
import { createEnrollmentSchema } from './schemas'

type Input = z.infer<typeof createEnrollmentSchema>

export async function createEnrollment(input: Input) {
  const parsed = createEnrollmentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const student = await studentGateway.findById(parsed.data.studentId)
  if (!student) return 'notFound' as const

  const plan = await planGateway.findById(parsed.data.planId)
  if (!plan) return 'notFound' as const

  const classPeriod = await classPeriodGateway.findById(parsed.data.classPeriodId)
  if (!classPeriod) return 'notFound' as const

  const isDuplicate = await enrollmentGateway.findDuplicate(
    parsed.data.studentId,
    parsed.data.classPeriodId
  )
  if (isDuplicate) return 'duplicateEnrollment' as const

  const totalAmount = calculateTotalAmount(Number(plan.amount), parsed.data.discount ?? 0)

  const result = await db.$transaction(async (tx) => {
    const enrolledCount = await tx.classAssignment.count({
      where: {
        classPeriodId: parsed.data.classPeriodId,
        endAt: null,
        enrollment: { status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] } },
      },
    })

    const capacityCheck = checkCapacity(classPeriod.capacity, enrolledCount)
    if (capacityCheck !== 'OK') return capacityCheck

    const enrollment = await tx.enrollment.create({
      data: {
        studentId: parsed.data.studentId,
        planId: parsed.data.planId,
        totalAmount,
        discount: parsed.data.discount,
        canLeaveAlone: parsed.data.canLeaveAlone,
      },
    })

    await tx.classAssignment.create({
      data: {
        enrollmentId: enrollment.id,
        classPeriodId: parsed.data.classPeriodId,
        startAt: new Date(),
      },
    })

    return enrollment
  })

  return result
}
