import type { ProfileGateway } from '@/gateways/profile-gateway'
import type { Result } from '@/shared/lang'

export type DeleteProfileFailure = 'profileNotFound'

export async function deleteProfile(
  userId: string,
  gateway: ProfileGateway
): Promise<Result<DeleteProfileFailure>> {
  const profile = await gateway.findByUserId(userId)

  if (!profile) {
    return 'profileNotFound'
  }

  await gateway.delete(userId)

  return 'OK'
}
