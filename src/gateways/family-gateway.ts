import { db } from '@/lib/db'

export const familyGateway = {
  createWithParents: (data: {
    name: string
    emergencyContactName?: string
    emergencyContactPhone?: string
    authorizedPickup?: string
    createdById: string
    parents: Array<{
      name: string
      lastname: string
      sex: 'MALE' | 'FEMALE'
      email?: string
      address?: string
      postCode?: string
      city?: string
      phoneNumber?: string
    }>
  }) =>
    db.$transaction(async (tx) => {
      const { parents, ...familyData } = data
      const family = await tx.family.create({ data: familyData })
      for (const { phoneNumber, ...person } of parents) {
        await tx.person.create({
          data: {
            ...person,
            families: {
              create: { familyId: family.id, relationType: 'PARENT' },
            },
            ...(phoneNumber ? { phoneNumbers: { create: { phoneNumber, channels: [] } } } : {}),
          },
        })
      }
      return family
    }),

  update: (
    id: string,
    data: {
      name?: string
      emergencyContactName?: string
      emergencyContactPhone?: string
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
