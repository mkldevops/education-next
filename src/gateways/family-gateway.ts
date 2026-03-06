import { db } from '@/lib/db'

export const familyGateway = {
  create: (data: {
    name: string
    emergencyContact?: string
    authorizedPickup?: string
    createdById: string
  }) => db.family.create({ data }),

  update: (
    id: string,
    data: {
      name?: string
      emergencyContact?: string
      authorizedPickup?: string
    }
  ) =>
    db.family.update({
      where: { id },
      data,
    }),

  deactivate: (id: string) =>
    db.family.update({
      where: { id },
      data: { isActive: false },
    }),

  findById: (id: string) =>
    db.family.findUnique({
      where: { id },
    }),

  list: () =>
    db.family.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),

  addPerson: (
    familyId: string,
    personId: string,
    relationType: 'PARENT' | 'TUTOR' | 'GRANDPARENT' | 'SIBLING' | 'OTHER'
  ) =>
    db.familyPerson.create({
      data: {
        familyId,
        personId,
        relationType,
      },
    }),

  linkUser: (userId: string, familyId: string) =>
    db.userFamily.create({
      data: {
        userId,
        familyId,
      },
    }),
}
