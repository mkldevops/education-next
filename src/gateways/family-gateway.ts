import { db, dbArchived } from '@/lib/db'

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
        sex?: 'MALE' | 'FEMALE'
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

  /**
   * Lecture de suppression : `dbArchived` pour qu'une famille déjà archivée reste
   * effaçable, alors que `findById` la masque.
   */
  findByIdIncludingArchived: (schoolId: string, id: string) =>
    dbArchived.family.findUnique({
      where: { id_schoolId: { id, schoolId } },
      select: { id: true, name: true },
    }),

  /**
   * Suppression définitive d'une famille et de son dossier.
   *
   * Les clés étrangères de `Payment`, `PaymentTransaction`, `Enrollment` et
   * `ClassAssignment` sont en `Restrict` : rien n'est cascadé par la base, chaque
   * table est donc effacée explicitement, de la feuille vers la racine. Ce qui reste
   * en `Cascade` — `UserFamily`, `FamilyPerson`, `PhoneNumber` — part avec son parent.
   *
   * Une personne rattachée à une autre famille survit : seul son lien à celle-ci
   * disparaît. Son élève et ses inscriptions appartiennent à cet autre dossier.
   *
   * Tout passe par `dbArchived` : une ligne archivée est invisible à `db` mais bloque
   * la suppression par sa clé étrangère.
   */
  deleteWithRelated: (schoolId: string, id: string) =>
    dbArchived.$transaction(async (tx) => {
      const links = await tx.familyPerson.findMany({
        where: { schoolId, familyId: id },
        select: { personId: true },
      })
      const personIds = links.map((link) => link.personId)

      const sharedLinks = personIds.length
        ? await tx.familyPerson.findMany({
            where: { schoolId, personId: { in: personIds }, familyId: { not: id } },
            select: { personId: true },
          })
        : []
      const shared = new Set(sharedLinks.map((link) => link.personId))
      const ownPersonIds = personIds.filter((personId) => !shared.has(personId))

      const students = ownPersonIds.length
        ? await tx.student.findMany({
            where: { schoolId, personId: { in: ownPersonIds } },
            select: { id: true },
          })
        : []
      const studentIds = students.map((student) => student.id)

      const enrollments = studentIds.length
        ? await tx.enrollment.findMany({
            where: { schoolId, studentId: { in: studentIds } },
            select: { id: true },
          })
        : []
      const enrollmentIds = enrollments.map((enrollment) => enrollment.id)

      if (enrollmentIds.length) {
        await tx.classAssignment.deleteMany({
          where: { schoolId, enrollmentId: { in: enrollmentIds } },
        })
      }

      await tx.payment.deleteMany({
        where: {
          schoolId,
          OR: [
            { familyId: id },
            ...(enrollmentIds.length ? [{ enrollmentId: { in: enrollmentIds } }] : []),
          ],
        },
      })
      await tx.paymentTransaction.deleteMany({ where: { schoolId, familyId: id } })
      // `ownPersonIds` et non `personIds` : les invitations d'une personne partagée
      // appartiennent à son autre famille. Seule sa disparition, qu'`Invitation.person`
      // interdit en `Restrict`, force la suppression des siennes.
      await tx.invitation.deleteMany({
        where: {
          schoolId,
          OR: [
            { familyId: id },
            ...(ownPersonIds.length ? [{ personId: { in: ownPersonIds } }] : []),
          ],
        },
      })

      if (enrollmentIds.length) {
        await tx.enrollment.deleteMany({ where: { schoolId, id: { in: enrollmentIds } } })
      }
      if (studentIds.length) {
        await tx.student.deleteMany({ where: { schoolId, id: { in: studentIds } } })
      }
      if (ownPersonIds.length) {
        await tx.person.deleteMany({ where: { schoolId, id: { in: ownPersonIds } } })
      }

      await tx.family.delete({ where: { id_schoolId: { id, schoolId } } })
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
  findMembersForMcp: (schoolId: string, id: string) =>
    db.family.findUnique({
      where: { id_schoolId: { id, schoolId } },
      select: {
        id: true,
        name: true,
        persons: {
          where: { relationType: { not: 'PARENT' }, person: { isActive: true } },
          select: {
            person: {
              select: {
                id: true,
                name: true,
                lastname: true,
                student: {
                  select: {
                    id: true,
                    enrollments: {
                      where: { isActive: true, status: { in: ['PENDING', 'ACTIVE'] } },
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),

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
