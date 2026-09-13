import type { z } from 'zod'
import { checkCapacity } from '@/domain/class-period'
import { calculateTotalAmount, validateDiscount } from '@/domain/enrollment'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { planGateway } from '@/gateways/plan-gateway'
import { studentGateway } from '@/gateways/student-gateway'
import { db } from '@/lib/db'
import { createEnrollmentSchema } from './schemas'

type Input = z.input<typeof createEnrollmentSchema>

export async function createEnrollment(input: Input) {
  const parsed = createEnrollmentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = parsed.data

  const student = await studentGateway.findById(schoolId, parsed.data.studentId)
  if (!student) return 'notFound' as const

  const plan = await planGateway.findById(schoolId, parsed.data.planId)
  if (!plan) return 'notFound' as const

  const classPeriod = await classPeriodGateway.findById(schoolId, parsed.data.classPeriodId)
  if (!classPeriod) return 'notFound' as const

  const existing = await enrollmentGateway.findActiveInPeriod(
    schoolId,
    parsed.data.studentId,
    parsed.data.classPeriodId
  )
  if (existing && !parsed.data.replaceExisting) return 'duplicateEnrollment' as const
  if (existing && existing._count.payments > 0) return 'existingEnrollmentPaid' as const

  const discount = parsed.data.discount ?? 0
  const planAmount = Number(plan.amount)

  const discountCheck = validateDiscount(planAmount, discount)
  if (discountCheck !== 'OK') return discountCheck

  const totalAmount = calculateTotalAmount(planAmount, discount)

  const result = await db.$transaction(async (tx) => {
    if (existing) {
      await tx.classAssignment.updateMany({
        where: { schoolId, enrollmentId: existing.id, endAt: null },
        data: { endAt: new Date() },
      })
      await tx.enrollment.update({
        where: { id_schoolId: { id: existing.id, schoolId } },
        data: { status: 'CANCELLED' },
      })
    }

    const enrolledCount = await tx.classAssignment.count({
      where: {
        schoolId,
        classPeriodId: parsed.data.classPeriodId,
        endAt: null,
        enrollment: { status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] } },
      },
    })

    const capacityCheck = checkCapacity(classPeriod.capacity, enrolledCount)
    if (capacityCheck !== 'OK') return capacityCheck

    const enrollment = await tx.enrollment.create({
      data: {
        schoolId,
        studentId: parsed.data.studentId,
        planId: parsed.data.planId,
        totalAmount,
        discount: parsed.data.discount,
        canLeaveAlone: parsed.data.canLeaveAlone,
      },
    })

    await tx.classAssignment.create({
      data: {
        schoolId,
        enrollmentId: enrollment.id,
        classPeriodId: parsed.data.classPeriodId,
        startAt: new Date(),
      },
    })

    return enrollment
  })

  return result
}
