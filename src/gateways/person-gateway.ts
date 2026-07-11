import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

export const personGateway = {
  create: (data: {
    name: string
    lastname: string
    sex: 'MALE' | 'FEMALE'
    email?: string
    address?: string
    postCode?: string
    city?: string
  }) => db.person.create({ data }),

  createWithFamily: (
    familyId: string,
    relationType: 'PARENT' | 'TUTOR' | 'GRANDPARENT' | 'SIBLING' | 'OTHER',
    data: {
      name: string
      lastname: string
      sex: 'MALE' | 'FEMALE'
      email?: string
      address?: string
      postCode?: string
      city?: string
    },
    phoneNumber?: string
  ) =>
    db.person.create({
      data: {
        ...data,
        families: { create: { familyId, relationType } },
        ...(phoneNumber ? { phoneNumbers: { create: { phoneNumber, channels: [] } } } : {}),
      },
    }),

  update: (id: string, data: Prisma.PersonUpdateInput) =>
    db.person.update({
      where: { id },
      data,
    }),

  findById: (id: string) =>
    db.person.findUnique({
      where: { id },
    }),

  addPhone: (
    personId: string,
    data: {
      phoneNumber: string
      channels: Prisma.InputJsonValue
    }
  ) =>
    db.phoneNumber.create({
      data: {
        personId,
        ...data,
      },
    }),
}
