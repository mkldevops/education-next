import type { Profile } from '@/domain/profile'

export interface ProfileGateway {
  findByUserId(userId: string): Promise<Profile | null>
  save(profile: Profile): Promise<void>
  delete(userId: string): Promise<void>
}
