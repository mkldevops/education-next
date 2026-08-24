import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

export const personGateway = {
  create: (
    schoolId: string,
    data: {
      name: string
      lastname: string
      sex: 'MALE' | 'FEMALE'
      email?: string
      address?: string
      postCode?: string
      city?: string
    }
  ) => db.person.create({ data: { ...data, schoolId } }),

  createWithFamily: (
    schoolId: string,
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
        schoolId,
        families: { create: { familyId, relationType } },
        ...(phoneNumber ? { phoneNumbers: { create: { phoneNumber, channels: [] } } } : {}),
      },
    }),

  update: (schoolId: string, id: string, data: Prisma.PersonUpdateInput) =>
    db.person.update({
      where: { id_schoolId: { id, schoolId } },
      data,
    }),

  findById: (schoolId: string, id: string) =>
    db.person.findUnique({
      where: { id_schoolId: { id, schoolId } },
    }),

  addPhone: (
    schoolId: string,
    personId: string,
    data: {
      phoneNumber: string
      channels: Prisma.InputJsonValue
    }
  ) =>
    db.phoneNumber.create({
      data: {
        schoolId,
        personId,
        ...data,
      },
    }),
}
