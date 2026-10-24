import type { Prisma, SchoolRole } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { inSerializableTransaction } from '@/lib/serializable-transaction'

/** Ordre d'affichage et de stockage : stable, sans doublon. */
const ROLE_ORDER: readonly SchoolRole[] = ['ADMIN', 'TEACHER', 'PARENT']

function normalizeRoles(roles: readonly SchoolRole[]): SchoolRole[] {
  return ROLE_ORDER.filter((role) => roles.includes(role))
}

/**
 * Applique un nouvel ensemble de rôles dans une transaction déjà `Serializable`.
 *
 * Perdre un rôle retire ce qu'il portait : `PARENT` ses liens famille, `TEACHER` le lien de sa
 * fiche enseignant. Sans cela, réattribuer le rôle plus tard ressusciterait un accès oublié.
 * Un ensemble vide retire l'appartenance : un membre sans rôle n'aurait aucun droit.
 * Retirer `ADMIN` au dernier administrateur est refusé.
 */
async function applyMemberRoles(
  tx: Prisma.TransactionClient,
  userId: string,
  schoolId: string,
  roles: readonly SchoolRole[]
) {
  const member = await tx.schoolMember.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
    select: { roles: true },
  })
  if (!member) return 'notFound' as const

  const next = normalizeRoles(roles)
  const lost = member.roles.filter((role) => !next.includes(role))
  if (lost.length === 0 && next.length === member.roles.length) return 'OK' as const

  if (lost.includes('ADMIN')) {
    const admins = await tx.schoolMember.count({ where: { schoolId, roles: { has: 'ADMIN' } } })
    if (admins <= 1) return 'lastAdmin' as const
  }

  if (next.length === 0 || lost.includes('TEACHER')) {
    await tx.teacher.updateMany({ where: { schoolId, userId }, data: { userId: null } })
  }
  if (next.length === 0 || lost.includes('PARENT')) {
    await tx.userFamily.deleteMany({ where: { userId, schoolId } })
  }

  if (next.length === 0) {
    await tx.schoolMember.delete({ where: { userId_schoolId: { userId, schoolId } } })
  } else {
    await tx.schoolMember.update({
      where: { userId_schoolId: { userId, schoolId } },
      data: { roles: next },
    })
  }
  return 'OK' as const
}

/** Retire `TEACHER` à un membre qui le détient, en lui laissant ses autres rôles. */
export async function withdrawTeacherRole(
  tx: Prisma.TransactionClient,
  userId: string,
  schoolId: string
) {
  const member = await tx.schoolMember.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
    select: { roles: true },
  })
  if (!member?.roles.includes('TEACHER')) return

  await applyMemberRoles(
    tx,
    userId,
    schoolId,
    member.roles.filter((role) => role !== 'TEACHER')
  )
}

/**
 * Accorde `role` dans une transaction : crée l'appartenance, ou ajoute le rôle à celle qui
 * existe. Inviter comme parent un enseignant de l'école lui ajoute l'accès parent.
 */
export async function grantMemberRole(
  tx: Prisma.TransactionClient,
  userId: string,
  schoolId: string,
  role: SchoolRole
) {
  const member = await tx.schoolMember.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
    select: { roles: true },
  })
  if (!member) {
    await tx.schoolMember.create({ data: { userId, schoolId, roles: [role] } })
    return
  }
  if (member.roles.includes(role)) return

  await tx.schoolMember.update({
    where: { userId_schoolId: { userId, schoolId } },
    data: { roles: normalizeRoles([...member.roles, role]) },
  })
}

/**
 * Seule frontière de lecture ET de mutation de `SchoolMember`.
 *
 * Ce modèle est volontairement hors du garde tenant : le contexte d'école doit lire
 * les appartenances par `userId` avant de connaître un `schoolId`, et le switcher doit
 * toutes les lister. Concentrer ces accès ici est ce qui remplace le garde — aucun
 * autre appelant ne doit atteindre `db.schoolMember`.
 */
export const schoolMemberGateway = {
  /**
   * Écoles ouvertes à un utilisateur. Un super-admin n'a aucune appartenance : ses
   * écoles sont résolues séparément, par `schoolGateway`.
   */
  listAuthorizedSchools: (userId: string) =>
    db.schoolMember.findMany({
      where: { userId, school: { isActive: true } },
      select: {
        schoolId: true,
        roles: true,
        createdAt: true,
        school: { select: { id: true, name: true, slug: true } },
      },
      // Départage explicite : un backfill ou un createMany produit des createdAt
      // identiques, et le repli du contexte doit rester déterministe.
      orderBy: [{ createdAt: 'asc' }, { schoolId: 'asc' }],
    }),

  findMembership: (userId: string, schoolId: string) =>
    db.schoolMember.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
      select: { userId: true, schoolId: true, roles: true },
    }),

  listSchoolMembers: (schoolId: string) =>
    db.schoolMember.findMany({
      where: { schoolId },
      select: {
        userId: true,
        roles: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            image: true,
            isSuperAdmin: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
    }),

  createMembership: (userId: string, schoolId: string, roles: readonly SchoolRole[]) =>
    db.schoolMember.create({ data: { userId, schoolId, roles: normalizeRoles(roles) } }),

  /**
   * Remplace les rôles qu'un administrateur attribue à la main (voir `applyMemberRoles`).
   * `TEACHER` suit le lien de la fiche enseignant : il est conservé tel quel. Un ensemble
   * vide est refusé, retirer un membre passe par `removeMembership`.
   *
   * Le comptage des administrateurs et la mutation partagent une transaction `Serializable` :
   * vérifier puis muter en deux appels séparés laisserait deux rétrogradations concurrentes
   * vider l'école de tout administrateur.
   */
  setAssignableRoles: (
    userId: string,
    schoolId: string,
    roles: readonly Exclude<SchoolRole, 'TEACHER'>[]
  ) =>
    inSerializableTransaction(async (tx) => {
      const member = await tx.schoolMember.findUnique({
        where: { userId_schoolId: { userId, schoolId } },
        select: { roles: true },
      })
      if (!member) return 'notFound' as const

      const next: SchoolRole[] = member.roles.includes('TEACHER')
        ? [...roles, 'TEACHER']
        : [...roles]
      if (next.length === 0) return 'noRole' as const
      return applyMemberRoles(tx, userId, schoolId, next)
    }),

  /**
   * Retire une appartenance, en refusant de retirer le dernier `ADMIN` de l'école.
   *
   * Les `UserFamily` de cette école partent dans la même transaction : la clé
   * étrangère composite `UserFamily -> SchoolMember` bloquerait autrement la
   * suppression. La fiche enseignant est libérée : le contexte refuse alors la session dès
   * la requête suivante, et une future invitation peut rattacher un remplaçant.
   */
  removeMembership: (userId: string, schoolId: string) =>
    inSerializableTransaction((tx) => applyMemberRoles(tx, userId, schoolId, [])),
}
