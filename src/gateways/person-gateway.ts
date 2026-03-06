import type { Prisma } from '@prisma/client'
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
      channels: string
    }
  ) =>
    db.phoneNumber.create({
      data: {
        personId,
        ...data,
      },
    }),
}
