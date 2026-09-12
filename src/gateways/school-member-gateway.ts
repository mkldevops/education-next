import type { SchoolRole } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { inSerializableTransaction } from '@/lib/serializable-transaction'

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
        role: true,
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
      select: { userId: true, schoolId: true, role: true },
    }),

  listSchoolMembers: (schoolId: string) =>
    db.schoolMember.findMany({
      where: { schoolId },
      select: {
        userId: true,
        role: true,
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
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    }),

  createMembership: (userId: string, schoolId: string, role: SchoolRole) =>
    db.schoolMember.create({ data: { userId, schoolId, role } }),

  /**
   * Rétrograde un membre, en refusant de retirer le dernier `ADMIN` de l'école.
   *
   * Le comptage et la mutation partagent une transaction `Serializable` : vérifier
   * puis muter en deux appels séparés laisserait deux rétrogradations concurrentes
   * vider l'école de tout administrateur.
   */
  changeMembershipRole: (userId: string, schoolId: string, role: SchoolRole) =>
    inSerializableTransaction(async (tx) => {
      const member = await tx.schoolMember.findUnique({
        where: { userId_schoolId: { userId, schoolId } },
        select: { role: true },
      })
      if (!member) return 'notFound' as const
      if (member.role === role) return 'OK' as const

      if (member.role === 'ADMIN') {
        const admins = await tx.schoolMember.count({ where: { schoolId, role: 'ADMIN' } })
        if (admins <= 1) return 'lastAdmin' as const
      }

      await tx.schoolMember.update({
        where: { userId_schoolId: { userId, schoolId } },
        data: { role },
      })
      return 'OK' as const
    }),

  /**
   * Retire une appartenance, en refusant de retirer le dernier `ADMIN` de l'école.
   *
   * Les `UserFamily` de cette école partent dans la même transaction : la clé
   * étrangère composite `UserFamily -> SchoolMember` bloquerait autrement la
   * suppression. Isolation `Serializable` pour la même raison que ci-dessus.
   */
  removeMembership: (userId: string, schoolId: string) =>
    inSerializableTransaction(async (tx) => {
      const member = await tx.schoolMember.findUnique({
        where: { userId_schoolId: { userId, schoolId } },
        select: { role: true },
      })
      if (!member) return 'notFound' as const

      if (member.role === 'ADMIN') {
        const admins = await tx.schoolMember.count({ where: { schoolId, role: 'ADMIN' } })
        if (admins <= 1) return 'lastAdmin' as const
      }

      await tx.userFamily.deleteMany({ where: { userId, schoolId } })
      await tx.schoolMember.delete({ where: { userId_schoolId: { userId, schoolId } } })
      return 'OK' as const
    }),
}
