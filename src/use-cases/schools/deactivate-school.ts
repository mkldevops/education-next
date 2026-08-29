import type { z } from 'zod'
import type { DeactivationVerdict } from '@/domain/school-deactivation'
import { schoolGateway } from '@/gateways/school-gateway'
import { schoolIdSchema } from './schemas'

type Input = z.infer<typeof schoolIdSchema>

export type DeactivateSchoolResult =
  | DeactivationVerdict
  | { status: 'validationError' }
  | { status: 'notFound' }
  | { status: 'alreadyInactive' }

/**
 * Les deux invariants ne sont pas évalués ici : ils exigent de lire les écoles actives
 * et les blocages **dans la transaction qui désactive**, sinon deux désactivations
 * concurrentes passent toutes les deux le contrôle. Le use-case pose les préalables
 * non concurrents et délègue le verdict au gateway.
 */
export async function deactivateSchool(
  input: Input,
  schoolGw = schoolGateway
): Promise<DeactivateSchoolResult> {
  const parsed = schoolIdSchema.safeParse(input)
  if (!parsed.success) return { status: 'validationError' }

  const school = await schoolGw.findById(parsed.data.id)
  if (!school) return { status: 'notFound' }
  if (!school.isActive) return { status: 'alreadyInactive' }

  return schoolGw.deactivate(parsed.data.id)
}
