import { z } from 'zod'
import { familyGateway } from '@/gateways/family-gateway'

const schema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
  confirmation: z.string().min(1),
})

type Input = z.infer<typeof schema>

/**
 * P2003 : une clé étrangère `Restrict` a refusé l'effacement. `deleteWithRelated` vide
 * toutes celles que le schéma déclare (`FAMILY_DELETION_CLEARED_RELATIONS`, verrouillée
 * par un test), donc ce refus ne peut venir que d'une table ajoutée sans elle. La
 * transaction est alors annulée en bloc : on le dit à l'administrateur plutôt que de
 * laisser l'erreur remonter jusqu'à l'error boundary.
 */
function isForeignKeyConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003'
}

/**
 * Suppression définitive, par opposition à `deactivateFamily` qui archive.
 *
 * Elle emporte le dossier entier — membres, élèves, présences, inscriptions, règlements
 * et transactions — donc le nom de la famille est redemandé, sur le modèle de
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

  try {
    await familyGateway.deleteWithRelated(parsed.data.schoolId, parsed.data.id)
  } catch (error) {
    if (isForeignKeyConstraintError(error)) return 'deletionBlocked' as const
    throw error
  }

  return 'OK' as const
}
