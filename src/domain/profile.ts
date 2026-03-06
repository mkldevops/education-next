import type { Result } from '@/shared/lang'
import { isEmpty } from '@/shared/lang'

export type ProfileState = {
  userId: string
  name: string
  bio: string | null
  image: string | null
  createdAt: string
  updatedAt: string
}

export type ProfileFailure = 'nameRequired'

export class Profile {
  readonly #userId: string
  #name: string
  #bio: string | null
  #image: string | null
  readonly #createdAt: Date
  #updatedAt: Date

  private constructor(
    userId: string,
    name: string,
    bio: string | null,
    image: string | null,
    createdAt: Date,
    updatedAt: Date
  ) {
    this.#userId = userId
    this.#name = name
    this.#bio = bio
    this.#image = image
    this.#createdAt = createdAt
    this.#updatedAt = updatedAt
  }

  get state(): ProfileState {
    return {
      userId: this.#userId,
      name: this.#name,
      bio: this.#bio,
      image: this.#image,
      createdAt: this.#createdAt.toISOString(),
      updatedAt: this.#updatedAt.toISOString(),
    }
  }

  get userId(): string {
    return this.#userId
  }

  get name(): string {
    return this.#name
  }

  get bio(): string | null {
    return this.#bio
  }

  get image(): string | null {
    return this.#image
  }

  changeName(name: string): Result<ProfileFailure> {
    if (isEmpty(name)) {
      return 'nameRequired'
    }
    this.#name = name
    this.#updatedAt = new Date()
    return 'OK'
  }

  changeBio(bio: string | null): void {
    this.#bio = bio
    this.#updatedAt = new Date()
  }

  changeImage(image: string | null): void {
    this.#image = image
    this.#updatedAt = new Date()
  }

  static create(data: {
    userId: string
    name: string
    bio?: string | null
    image?: string | null
    createdAt?: Date
    updatedAt?: Date
  }): Result<ProfileFailure, Profile> {
    if (isEmpty(data.name)) {
      return 'nameRequired'
    }

    return new Profile(
      data.userId,
      data.name,
      data.bio ?? null,
      data.image ?? null,
      data.createdAt ?? new Date(),
      data.updatedAt ?? new Date()
    )
  }
}
