import { db } from '@/lib/db'

export const familyGateway = {
  createWithParents: (
    schoolId: string,
    data: {
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
    }
  ) =>
    db.$transaction(async (tx) => {
      const { parents, ...familyData } = data
      const family = await tx.family.create({ data: { ...familyData, schoolId } })
      for (const { phoneNumber, ...person } of parents) {
        await tx.person.create({
          data: {
            ...person,
            schoolId,
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
    schoolId: string,
    id: string,
    data: {
      name?: string
      emergencyContactName?: string | null
      emergencyContactPhone?: string | null
      authorizedPickup?: string | null
    }
  ) =>
    db.family.update({
      where: { id_schoolId: { id, schoolId } },
      data,
    }),

  deactivate: (schoolId: string, id: string) =>
    db.family.update({
      where: { id_schoolId: { id, schoolId } },
      data: { isActive: false },
    }),

  findById: (schoolId: string, id: string) =>
    db.family.findUnique({
      where: { id_schoolId: { id, schoolId } },
    }),

  hasActiveEnrollments: async (schoolId: string, id: string) => {
    const count = await db.enrollment.count({
      where: {
        schoolId,
        status: { in: ['PENDING', 'ACTIVE'] },
        student: { person: { families: { some: { familyId: id } } } },
      },
    })
    return count > 0
  },

  list: (schoolId: string) =>
    db.family.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: 'asc' },
    }),

  /**
   * Sonde de doublons du `preview_*` MCP. Projection volontairement étroite : le contexte
   * d'un modèle n'a besoin que d'un nom et d'un identifiant pour signaler une homonymie.
   */
  searchByName: (schoolId: string, name: string) =>
    db.family.findMany({
      where: { schoolId, name: { contains: name, mode: 'insensitive' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 10,
    }),

  addPerson: (
    schoolId: string,
    familyId: string,
    personId: string,
    relationType: 'PARENT' | 'TUTOR' | 'GRANDPARENT' | 'SIBLING' | 'OTHER'
  ) =>
    db.familyPerson.create({
      data: {
        schoolId,
        familyId,
        personId,
        relationType,
      },
    }),

  findPerson: (schoolId: string, familyId: string, personId: string) =>
    db.familyPerson.findFirst({
      where: { schoolId, familyId, personId },
    }),

  linkUser: (schoolId: string, userId: string, familyId: string) =>
    db.userFamily.create({
      data: {
        schoolId,
        userId,
        familyId,
      },
    }),
}
