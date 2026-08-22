'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { activateEnrollment } from '@/use-cases/enrollments/activate-enrollment'
import { applyDiscount } from '@/use-cases/enrollments/apply-discount'
import { cancelEnrollment } from '@/use-cases/enrollments/cancel-enrollment'
import { completeEnrollment } from '@/use-cases/enrollments/complete-enrollment'
import { createEnrollment } from '@/use-cases/enrollments/create-enrollment'
import { previewPromoteStudents, promoteStudents } from '@/use-cases/enrollments/promote-students'
import { reassignClass } from '@/use-cases/enrollments/reassign-class'
import type {
  applyDiscountSchema,
  createEnrollmentSchema,
  enrollmentIdSchema,
  promoteStudentsSchema,
  reassignClassSchema,
} from '@/use-cases/enrollments/schemas'
import { requireSchoolAdmin } from './auth-helper'

type CreateEnrollmentInput = Omit<z.infer<typeof createEnrollmentSchema>, 'schoolId'>
type ActivateEnrollmentInput = Omit<z.infer<typeof enrollmentIdSchema>, 'schoolId'>
type CompleteEnrollmentInput = Omit<z.infer<typeof enrollmentIdSchema>, 'schoolId'>
type ReassignClassInput = Omit<z.infer<typeof reassignClassSchema>, 'schoolId'>
type ApplyDiscountInput = Omit<z.infer<typeof applyDiscountSchema>, 'schoolId'>
type PromoteStudentsInput = Omit<z.infer<typeof promoteStudentsSchema>, 'schoolId'>

export async function createEnrollmentAction(data: CreateEnrollmentInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createEnrollment({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/enrollments')
  revalidatePath('/dashboard/families', 'layout')
  return result
}

export async function activateEnrollmentAction(data: ActivateEnrollmentInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await activateEnrollment({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/enrollments')
  return 'OK' as const
}

export async function completeEnrollmentAction(data: CompleteEnrollmentInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await completeEnrollment({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/enrollments')
  return 'OK' as const
}

export async function cancelEnrollmentAction(enrollmentId: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await cancelEnrollment({ schoolId, id: enrollmentId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/enrollments')
  return 'OK' as const
}

export async function reassignClassAction(data: ReassignClassInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await reassignClass({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/enrollments')
  return 'OK' as const
}

export async function applyDiscountAction(data: ApplyDiscountInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await applyDiscount({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/enrollments')
  return 'OK' as const
}

export async function promoteStudentsAction(data: PromoteStudentsInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await promoteStudents({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/enrollments')
  return result
}

export async function previewPromoteStudentsAction(data: PromoteStudentsInput) {
  const { schoolId } = await requireSchoolAdmin()
  return previewPromoteStudents({ ...data, schoolId })
}
