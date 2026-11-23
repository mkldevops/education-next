import type { z } from 'zod'
import { familyGateway } from '@/gateways/family-gateway'
import { attachStudentToFamilySchema } from './schemas'

type Input = z.infer<typeof attachStudentToFamilySchema>

/** Rattache un élève sans famille à une famille de l'école, qui devient sa famille redevable. */
export async function attachStudentToFamily(input: Input, gateway = familyGateway) {
  const parsed = attachStudentToFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, familyId, studentId } = parsed.data
  return gateway.attachStudent(schoolId, familyId, studentId)
}
