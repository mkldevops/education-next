import type { Prisma, PrismaClient } from '@/generated/prisma/client'
import { db, dbArchived } from '@/lib/db'

/** Client applicatif ou client de transaction : la traversée ci-dessous accepte les deux. */
type Reader = Pick<PrismaClient, 'familyPerson' | 'student' | 'enrollment'>

/**
 * Périmètre exact d'une suppression de famille, résolu une seule fois et partagé par
 * `countDeletionImpact` et `deleteWithRelated` : l'aperçu montré à l'administrateur et
 * ce que la transaction efface sont ainsi le même ensemble, par construction.
 *
 * Appelé sur `dbArchived`, donc archives comprises — une ligne archivée est invisible à
 * `db` mais bloque la suppression par sa clé étrangère, et serait absente du compte.
 */
async function resolveDeletionScope(client: Reader, schoolId: string, id: string) {
  const links = await client.familyPerson.findMany({
    where: { schoolId, familyId: id },
    select: { personId: true },
  })
  const personIds = links.map((link) => link.personId)

  // Une personne rattachée ailleurs n'est pas effacée : son dossier appartient aussi à
  // l'autre famille, seul son lien à celle-ci disparaît par cascade.
  const sharedLinks = personIds.length
    ? await client.familyPerson.findMany({
        where: { schoolId, personId: { in: personIds }, familyId: { not: id } },
        select: { personId: true },
      })
    : []
  const shared = new Set(sharedLinks.map((link) => link.personId))
  const ownPersonIds = personIds.filter((personId) => !shared.has(personId))

  const students = ownPersonIds.length
    ? await client.student.findMany({
        where: { schoolId, personId: { in: ownPersonIds } },
        select: { id: true },
      })
    : []
  const studentIds = students.map((student) => student.id)

  const enrollments = studentIds.length
    ? await client.enrollment.findMany({
        where: { schoolId, studentId: { in: studentIds } },
        select: { id: true },
      })
    : []
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id)

  const paymentWhere: Prisma.PaymentWhereInput = {
    schoolId,
    OR: [
      { familyId: id },
      ...(enrollmentIds.length ? [{ enrollmentId: { in: enrollmentIds } }] : []),
    ],
  }

  return { ownPersonIds, studentIds, enrollmentIds, paymentWhere }
}

export const familyGateway = {
  createWithParents: (
    schoolId: string,
    data: {
      name: string
      emergencyContactName?: string
      emergencyContactPhone?: string
      authorizedPickup?: string
      languagesAtHome?: string[]
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
      languagesAtHome?: string[]
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
   * Ce que la suppression emportera, compté par la traversée qu'elle exécute :
   * `resolveDeletionScope` sur `dbArchived`, donc archives comprises, et `members`
   * ne compte que les personnes réellement effacées. L'aperçu du dialogue serait
   * sinon celui de la page, filtré sur `isActive`, et annoncerait zéro élève là où
   * la transaction en détruit un archivé.
   */
  countDeletionImpact: async (schoolId: string, id: string) => {
    const { ownPersonIds, studentIds, enrollmentIds, paymentWhere } = await resolveDeletionScope(
      dbArchived,
      schoolId,
      id
    )

    const payments = await dbArchived.payment.count({ where: paymentWhere })
    return {
      members: ownPersonIds.length,
      students: studentIds.length,
      enrollments: enrollmentIds.length,
      payments,
    }
  },

  /**
   * Suppression définitive d'une famille et de son dossier.
   *
   * Aucune de ces tables n'est cascadée par la base : `Payment.family` et
   * `PaymentTransaction.family` pointent la famille en `Restrict`, `Enrollment.student`,
   * `ClassAssignment.enrollment` et `Invitation.person` en font autant sur les maillons
   * suivants. D'où l'effacement explicite, de la feuille vers la racine. Ce qui est en
   * `Cascade` — `UserFamily`, `FamilyPerson`, `PhoneNumber`, `Invitation.family` — part
   * avec son parent, et `PaymentProviderEvent` est détaché en `SET NULL`.
   *
   * Une personne rattachée à une autre famille survit : seul son lien à celle-ci
   * disparaît. Son élève et ses inscriptions appartiennent à cet autre dossier.
   *
   * Tout passe par `dbArchived` : une ligne archivée est invisible à `db` mais bloque
   * la suppression par sa clé étrangère.
   */
  deleteWithRelated: (schoolId: string, id: string) =>
    dbArchived.$transaction(async (tx) => {
      const { ownPersonIds, studentIds, enrollmentIds, paymentWhere } = await resolveDeletionScope(
        tx,
        schoolId,
        id
      )

      if (enrollmentIds.length) {
        await tx.classAssignment.deleteMany({
          where: { schoolId, enrollmentId: { in: enrollmentIds } },
        })
      }

      // La seconde branche efface un règlement porté par une autre famille s'il vise
      // une inscription d'ici. Inatteignable : un règlement est toujours écrit avec le
      // `familyId` du payeur et une inscription tirée de son propre solde, et aucun
      // chemin ne supprime une ligne `FamilyPerson` — une personne ne peut donc pas
      // perdre son second rattachement et rendre « propre » une inscription déjà payée
      // par ailleurs. Inévitable de toute façon : `Payment.enrollment` est `Restrict`.
      await tx.payment.deleteMany({ where: paymentWhere })
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
