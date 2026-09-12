import type { ProfileGateway } from '@/gateways/profile-gateway'
import type { Result } from '@/shared/lang'
import { countUserDeletionBlockers } from '@/use-cases/users/count-deletion-blockers'

export type DeleteProfileFailure = 'profileNotFound' | 'hasRelatedRecords'

/**
 * Le décompte des bloqueurs est injecté plutôt qu'ajouté à `ProfileGateway` : la question
 * porte sur la plateforme entière, pas sur le profil, et la passerelle de profil n'a pas
 * à connaître les familles, les paiements ni les clés machine.
 *
 * Sans ce refus, la suppression libre-service atteindrait la contrainte `Restrict` de la
 * base et remonterait une erreur Prisma brute au lieu d'un refus traduit.
 */
export async function deleteProfile(
  userId: string,
  gateway: ProfileGateway,
  countBlockers: (userId: string) => Promise<number> = countUserDeletionBlockers
): Promise<Result<DeleteProfileFailure>> {
  const profile = await gateway.findByUserId(userId)

  if (!profile) {
    return 'profileNotFound'
  }

  if ((await countBlockers(userId)) > 0) {
    return 'hasRelatedRecords'
  }

  await gateway.delete(userId)

  return 'OK'
}
