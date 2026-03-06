import type { z } from 'zod'
import { checkCapacity } from '@/domain/class-period'
import { calculateTotalAmount } from '@/domain/enrollment'
import { classAssignmentGateway } from '@/gateways/class-assignment-gateway'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { planGateway } from '@/gateways/plan-gateway'
import { studentGateway } from '@/gateways/student-gateway'
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
    parsed.data.planId
  )
  if (isDuplicate) return 'duplicateEnrollment' as const

  const enrolled = await classPeriodGateway.countEnrolled(parsed.data.classPeriodId)
  const capacityCheck = checkCapacity(classPeriod.capacity, enrolled)
  if (capacityCheck !== 'OK') return capacityCheck

  const totalAmount = calculateTotalAmount(Number(plan.amount), parsed.data.discount ?? 0)

  const enrollment = await enrollmentGateway.create({
    studentId: parsed.data.studentId,
    planId: parsed.data.planId,
    totalAmount,
    discount: parsed.data.discount,
    canLeaveAlone: parsed.data.canLeaveAlone,
  })

  await classAssignmentGateway.create({
    enrollmentId: enrollment.id,
    classPeriodId: parsed.data.classPeriodId,
  })

  return enrollment
}
