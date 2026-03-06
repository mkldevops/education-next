import type { ProfileFailure } from '@/domain/profile'
import type { ProfileGateway } from '@/gateways/profile-gateway'
import type { Result } from '@/shared/lang'
import { isFailure } from '@/shared/lang'

export type UpdateProfileData = {
  name?: string
  bio?: string | null
  image?: string | null
}

export type UpdateProfileFailure = ProfileFailure | 'profileNotFound'

export async function updateProfile(
  userId: string,
  data: UpdateProfileData,
  gateway: ProfileGateway
): Promise<Result<UpdateProfileFailure>> {
  const profile = await gateway.findByUserId(userId)

  if (!profile) {
    return 'profileNotFound'
  }

  if (data.name !== undefined) {
    const result = profile.changeName(data.name)
    if (isFailure(result)) return result
  }

  if (data.bio !== undefined) {
    profile.changeBio(data.bio)
  }

  if (data.image !== undefined) {
    profile.changeImage(data.image)
  }

  await gateway.save(profile)

  return 'OK'
}
