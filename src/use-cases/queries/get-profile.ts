import type { ProfileState } from '@/domain/profile'
import type { ProfileGateway } from '@/gateways/profile-gateway'

export type GetProfileResult = ProfileState | 'profileNotFound'

export async function getProfile(
  userId: string,
  gateway: ProfileGateway
): Promise<GetProfileResult> {
  const profile = await gateway.findByUserId(userId)

  if (!profile) {
    return 'profileNotFound'
  }

  return profile.state
}
