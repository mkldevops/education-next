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

  updateWithFamily: (
    schoolId: string,
    familyId: string,
    personId: string,
    data: {
      person: {
        name?: string
        lastname?: string
        sex?: 'MALE' | 'FEMALE'
        email?: string | null
        address?: string | null
        postCode?: string | null
        city?: string | null
      }
      relationType?: 'PARENT' | 'TUTOR' | 'GRANDPARENT' | 'SIBLING' | 'OTHER'
      phoneNumber?: string | null
    }
  ) =>
    db.$transaction(async (tx) => {
      const person = await tx.person.update({
        where: { id_schoolId: { id: personId, schoolId } },
        data: data.person,
      })

      if (data.relationType) {
        await tx.familyPerson.update({
          where: { familyId_personId: { familyId, personId } },
          data: { relationType: data.relationType },
        })
      }

      if (data.phoneNumber !== undefined) {
        const current = await tx.phoneNumber.findFirst({
          where: { schoolId, personId, isActive: true },
          orderBy: { createdAt: 'asc' },
        })

        if (data.phoneNumber === null) {
          if (current) {
            await tx.phoneNumber.update({ where: { id: current.id }, data: { isActive: false } })
          }
        } else if (current) {
          await tx.phoneNumber.update({
            where: { id: current.id },
            data: { phoneNumber: data.phoneNumber },
          })
        } else {
          await tx.phoneNumber.create({
            data: { schoolId, personId, phoneNumber: data.phoneNumber, channels: [] },
          })
        }
      }

      return person
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
