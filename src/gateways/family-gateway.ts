import { OPEN_ENROLLMENT_STATUSES } from '@/domain/enrollment'
import { lockActiveFamily } from '@/gateways/family-mutation-lock'
import type { Prisma, PrismaClient } from '@/generated/prisma/client'
import { db, dbArchived } from '@/lib/db'

/**
 * Clés étrangères non cascadées (`Restrict`, explicite ou implicite) qui pointent vers une
 * ligne effacée par `deleteWithRelated`, et que la transaction vide donc elle-même avant
 * leur cible. `family-deletion-restrict-guard.test.ts` relit `schema.prisma` et échoue si
 * une relation de ce genre apparaît sans figurer ici : c'est le rappel qu'une nouvelle
 * table rattachée à un élève, une personne ou une famille doit aussi être effacée.
 */
export const FAMILY_DELETION_CLEARED_RELATIONS = [
  'AttendanceEntry.student',
  'ClassAssignment.enrollment',
  'Payment.family',
  'Payment.enrollment',
  'Payment.paymentTransaction',
  'Payment.receipt',
  'Receipt.family',
  'PaymentTransaction.family',
  'Invitation.person',
  'Enrollment.student',
] as const

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

    const [payments, attendances] = await Promise.all([
      dbArchived.payment.count({ where: paymentWhere }),
      studentIds.length
        ? dbArchived.attendanceEntry.count({ where: { schoolId, studentId: { in: studentIds } } })
        : 0,
    ])
    return {
      members: ownPersonIds.length,
      students: studentIds.length,
      enrollments: enrollmentIds.length,
      payments,
      attendances,
    }
  },

  /**
   * Suppression définitive d'une famille et de son dossier.
   *
   * Aucune de ces tables n'est cascadée par la base : `Payment.family` et
   * `PaymentTransaction.family` pointent la famille en `Restrict`, `Enrollment.student`,
   * `AttendanceEntry.student`, `ClassAssignment.enrollment` et `Invitation.person` en font
   * autant sur les maillons suivants (liste tenue dans `FAMILY_DELETION_CLEARED_RELATIONS`).
   * D'où l'effacement explicite, de la feuille vers la racine. Ce qui est en
   * `Cascade` — `UserFamily`, `FamilyPerson`, `PhoneNumber`, `Invitation.family` — part
   * avec son parent, et `PaymentProviderEvent` est détaché en `SET NULL`. Les reçus de
   * caisse (`Receipt.family`) sont effacés eux aussi, leurs `MealPayment` en cascade.
   *
   * Une personne rattachée à une autre famille survit : seul son lien à celle-ci
   * disparaît. Son élève et ses inscriptions appartiennent à cet autre dossier.
   *
   * Tout passe par `dbArchived` : une ligne archivée est invisible à `db` mais bloque
   * la suppression par sa clé étrangère.
   *
   * La ligne `Family` est verrouillée avant toute lecture, dans l'ordre que prend un
   * encaissement (`paymentGateway.lockFamilyForPayment`, puis insertion du règlement qui
   * pose un `KEY SHARE` sur l'inscription). Sans ce verrou, la suppression tient déjà
   * l'inscription quand le paiement attend sur elle, et Postgres tranche par un deadlock.
   * `FOR UPDATE` et non `FOR NO KEY UPDATE` : la ligne va disparaître. Pas de filtre
   * `isActive`, une famille archivée reste effaçable.
   *
   * Rend `false` quand la famille a disparu entre la lecture du cas d'usage et le verrou.
   */
  deleteWithRelated: (schoolId: string, id: string) =>
    dbArchived.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Family"
        WHERE "id" = ${id} AND "schoolId" = ${schoolId}
        FOR UPDATE`
      if (locked.length !== 1) return false

      const { ownPersonIds, studentIds, enrollmentIds, paymentWhere } = await resolveDeletionScope(
        tx,
        schoolId,
        id
      )

      // Les présences d'un élève effacé partent avec lui : sans élève, la ligne ne désigne
      // plus personne. La séance d'appel reste, son effectif amputé de cet élève.
      if (studentIds.length) {
        await tx.attendanceEntry.deleteMany({
          where: { schoolId, studentId: { in: studentIds } },
        })
      }

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
      // Après les règlements, que `Payment.receipt` retient en `Restrict`. Les lignes
      // repas du reçu partent avec lui en cascade.
      await tx.receipt.deleteMany({ where: { schoolId, familyId: id } })
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
      return true
    }),

  hasActiveEnrollments: async (schoolId: string, id: string) => {
    const count = await db.enrollment.count({
      where: {
        schoolId,
        status: { in: [...OPEN_ENROLLMENT_STATUSES] },
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
                      where: { isActive: true, status: { in: [...OPEN_ENROLLMENT_STATUSES] } },
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

  /** Familles actives de l'élève : un enfant de parents séparés peut en avoir deux. */
  findByStudent: (schoolId: string, studentId: string) =>
    db.family.findMany({
      where: { schoolId, persons: { some: { person: { student: { id: studentId } } } } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
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
    db.$transaction(async (tx) => {
      if (!(await lockActiveFamily(tx, schoolId, familyId))) return null
      return tx.familyPerson.create({ data: { schoolId, familyId, personId, relationType } })
    }),

  /**
   * Rattache un élève actif sans famille à une famille active, comme enfant (`OTHER`). Un élève
   * déjà rattaché ailleurs est refusé : la famille redevable de ses inscriptions changerait.
   */
  attachStudent: (schoolId: string, familyId: string, studentId: string) =>
    db.$transaction(async (tx) => {
      if (!(await lockActiveFamily(tx, schoolId, familyId))) return 'notFound' as const
      const student = await tx.student.findFirst({
        where: { id: studentId, schoolId, isActive: true },
        select: { personId: true, person: { select: { _count: { select: { families: true } } } } },
      })
      if (!student) return 'notFound' as const
      if (student.person._count.families > 0) return 'hasFamily' as const
      await tx.familyPerson.create({
        data: { schoolId, familyId, personId: student.personId, relationType: 'OTHER' },
      })
      return 'OK' as const
    }),

  /**
   * Crée une famille autour d'un élève actif sans famille, qui y entre comme enfant (`OTHER`).
   * La ligne `Person` est verrouillée : deux créations simultanées ne rattachent pas l'élève deux fois.
   */
  createForStudent: (
    schoolId: string,
    studentId: string,
    data: {
      name: string
      emergencyContactName?: string
      emergencyContactPhone?: string
      createdById: string
    }
  ) =>
    db.$transaction(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, schoolId, isActive: true },
        select: { personId: true },
      })
      if (!student) return 'notFound' as const
      await tx.$queryRaw`
        SELECT "id" FROM "Person"
        WHERE "id" = ${student.personId} AND "schoolId" = ${schoolId}
        FOR UPDATE`
      const linked = await tx.familyPerson.count({
        where: { schoolId, personId: student.personId },
      })
      if (linked > 0) return 'hasFamily' as const
      const family = await tx.family.create({ data: { ...data, schoolId } })
      await tx.familyPerson.create({
        data: {
          schoolId,
          familyId: family.id,
          personId: student.personId,
          relationType: 'OTHER',
        },
      })
      return { id: family.id, name: family.name }
    }),

  findPerson: (schoolId: string, familyId: string, personId: string) =>
    db.familyPerson.findFirst({
      where: { schoolId, familyId, personId },
    }),

  linkUser: (schoolId: string, userId: string, familyId: string) =>
    db.$transaction(async (tx) => {
      if (!(await lockActiveFamily(tx, schoolId, familyId))) return null
      return tx.userFamily.create({ data: { schoolId, userId, familyId } })
    }),
}
