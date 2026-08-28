import { Profile } from '@/domain/profile'
import type { ProfileGateway } from './profile-gateway'

type PrismaLike = {
  user: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string
      name: string | null
      image: string | null
      createdAt: Date
      updatedAt: Date
    } | null>
    update: (args: {
      where: { id: string }
      data: { name?: string; image?: string | null; updatedAt?: Date }
    }) => Promise<unknown>
    delete: (args: { where: { id: string } }) => Promise<unknown>
  }
}

export class PrismaProfileGateway implements ProfileGateway {
  #prisma: PrismaLike

  constructor(prisma: PrismaLike) {
    this.#prisma = prisma
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    const data = await this.#prisma.user.findUnique({ where: { id: userId } })
    if (!data?.name) return null
    return this.#toDomain({
      id: data.id,
      name: data.name,
      image: data.image,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    })
  }

  async save(profile: Profile): Promise<void> {
    const state = profile.state
    await this.#prisma.user.update({
      where: { id: state.userId },
      data: {
        name: state.name,
        image: state.image,
        updatedAt: new Date(state.updatedAt),
      },
    })
  }

  async delete(userId: string): Promise<void> {
    await this.#prisma.user.delete({ where: { id: userId } })
  }

  #toDomain(data: {
    id: string
    name: string
    image: string | null
    createdAt: Date
    updatedAt: Date
  }): Profile | null {
    const result = Profile.create({
      userId: data.id,
      name: data.name,
      image: data.image,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    })
    if (typeof result === 'string') return null
    return result
  }
}
