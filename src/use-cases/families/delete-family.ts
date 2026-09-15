import { z } from 'zod'
import { familyGateway } from '@/gateways/family-gateway'

const schema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
  confirmation: z.string().min(1),
})

type Input = z.infer<typeof schema>

/**
 * Suppression définitive, par opposition à `deactivateFamily` qui archive.
 *
 * Elle emporte le dossier entier — membres, élèves, inscriptions, règlements et
 * transactions — donc le nom de la famille est redemandé, sur le modèle de
 * `deleteUser` : c'est la seule barrière entre un clic et une histoire financière
 * irrécupérable.
 */
export async function deleteFamily(input: Input) {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const family = await familyGateway.findByIdIncludingArchived(parsed.data.schoolId, parsed.data.id)
  if (!family) return 'notFound' as const
  if (family.name.trim().toLowerCase() !== parsed.data.confirmation.trim().toLowerCase()) {
    return 'confirmationMismatch' as const
  }

  await familyGateway.deleteWithRelated(parsed.data.schoolId, parsed.data.id)

  return 'OK' as const
}
