'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { activateEnrollment } from '@/use-cases/enrollments/activate-enrollment'
import { applyDiscount } from '@/use-cases/enrollments/apply-discount'
import { cancelEnrollment } from '@/use-cases/enrollments/cancel-enrollment'
import { completeEnrollment } from '@/use-cases/enrollments/complete-enrollment'
import { createEnrollment } from '@/use-cases/enrollments/create-enrollment'
import { promoteStudents } from '@/use-cases/enrollments/promote-students'
import { reassignClass } from '@/use-cases/enrollments/reassign-class'
import type {
  applyDiscountSchema,
  createEnrollmentSchema,
  enrollmentIdSchema,
  promoteStudentsSchema,
  reassignClassSchema,
} from '@/use-cases/enrollments/schemas'
import { requireAdmin } from './auth-helper'

type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>
type ActivateEnrollmentInput = z.infer<typeof enrollmentIdSchema>
type CompleteEnrollmentInput = z.infer<typeof enrollmentIdSchema>
type ReassignClassInput = z.infer<typeof reassignClassSchema>
type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>
type PromoteStudentsInput = z.infer<typeof promoteStudentsSchema>

export async function createEnrollmentAction(data: CreateEnrollmentInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await createEnrollment(data)
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/enrollments')
  return result
}

export async function activateEnrollmentAction(data: ActivateEnrollmentInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await activateEnrollment(data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/enrollments')
  return 'OK' as const
}

export async function completeEnrollmentAction(data: CompleteEnrollmentInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await completeEnrollment(data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/enrollments')
  return 'OK' as const
}

export async function cancelEnrollmentAction(enrollmentId: string) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await cancelEnrollment({ id: enrollmentId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/enrollments')
  return 'OK' as const
}

export async function reassignClassAction(data: ReassignClassInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await reassignClass(data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/enrollments')
  return 'OK' as const
}

export async function applyDiscountAction(data: ApplyDiscountInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await applyDiscount(data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/enrollments')
  return 'OK' as const
}

export async function promoteStudentsAction(data: PromoteStudentsInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await promoteStudents(data)
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/enrollments')
  return result
}
