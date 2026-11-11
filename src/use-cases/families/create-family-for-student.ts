import type { z } from 'zod'
import { validateFamilyName } from '@/domain/family'
import { familyGateway } from '@/gateways/family-gateway'
import { createFamilyForStudentSchema } from './schemas'

type Input = z.input<typeof createFamilyForStudentSchema>

/** Crée la famille d'un élève qui n'en a pas encore ; elle devient sa famille redevable. */
export async function createFamilyForStudent(input: Input, gateway = familyGateway) {
  const parsed = createFamilyForStudentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, studentId, name, ...rest } = parsed.data
  if (validateFamilyName(name) !== 'OK') return 'validationError' as const
  return gateway.createForStudent(schoolId, studentId, {
    name,
    emergencyContactName: rest.emergencyContactName || undefined,
    emergencyContactPhone: rest.emergencyContactPhone || undefined,
    createdById: rest.createdById,
  })
}
