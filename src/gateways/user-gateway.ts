import { db, dbArchived } from '@/lib/db'

const listSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  isSuperAdmin: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

export const userGateway = {
  findById: (id: string) =>
    db.user.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    }),

  findManaged: (id: string) =>
    dbArchived.user.findUnique({
      where: { id },
      select: { id: true, isSuperAdmin: true, isActive: true, email: true },
    }),

  findByEmail: (email: string) =>
    dbArchived.user.findUnique({
      where: { email },
      select: { id: true },
    }),

  countActiveSuperAdmins: () =>
    dbArchived.user.count({ where: { isSuperAdmin: true, isActive: true } }),

  /**
   * Lecture plateforme, volontairement hors de toute école : un super-admin ne possède
   * en général aucune ligne `SchoolMember` et reste donc invisible aux listes scopées.
   * `dbArchived` fait aussi apparaître les comptes désactivés, qu'une revue des accès
   * doit pouvoir constater.
   */
  listSuperAdmins: () =>
    dbArchived.user.findMany({
      where: { isSuperAdmin: true },
      select: {
        ...listSelect,
        schoolMemberships: {
          select: { school: { select: { id: true, name: true } } },
          orderBy: { school: { name: 'asc' } },
        },
        sessions: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ isActive: 'desc' }, { email: 'asc' }],
    }),

  /**
   * `schoolId` est requis, et il n'est pas décoratif : sans lui, tout administrateur
   * d'école lisait par les relations imbriquées les familles, les enfants et les
   * invitations des **autres** écoles d'un compte partagé. La garde tenant ne peut pas
   * l'attraper — elle n'inspecte que la racine des requêtes.
   *
   * `accounts`, `sessions` et `passkeys` restent globaux : ce sont des modèles
   * plateforme, ils n'appartiennent à aucune école.
   */
  findDetail: (id: string, schoolId: string) =>
    dbArchived.user.findUnique({
      where: { id },
      select: {
        ...listSelect,
        accounts: {
          select: { id: true, providerId: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        sessions: {
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            expiresAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        passkeys: {
          select: {
            id: true,
            name: true,
            deviceType: true,
            backedUp: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        families: {
          where: { schoolId },
          select: {
            family: {
              select: {
                id: true,
                name: true,
                isActive: true,
                persons: {
                  select: {
                    relationType: true,
                    person: {
                      select: {
                        id: true,
                        name: true,
                        lastname: true,
                        isActive: true,
                        student: {
                          select: {
                            id: true,
                            _count: { select: { enrollments: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        createdInvitations: {
          where: { schoolId },
          select: { id: true, email: true, role: true, createdAt: true, usedAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            sessions: true,
            passkeys: true,
            accounts: true,
            createdFamilies: { where: { schoolId } },
            createdInvitations: { where: { schoolId } },
            paymentTransactions: { where: { schoolId } },
          },
        },
      },
    }),

  update: (id: string, data: { name?: string | null; email?: string; emailVerified?: boolean }) =>
    dbArchived.user.update({ where: { id }, data, select: listSelect }),

  setPlatformLevel: (id: string, isSuperAdmin: boolean) =>
    dbArchived.user.update({ where: { id }, data: { isSuperAdmin }, select: listSelect }),

  setActive: (id: string, isActive: boolean) =>
    dbArchived.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { isActive },
        select: listSelect,
      })
      if (!isActive) {
        await tx.session.deleteMany({ where: { userId: id } })
      }
      return user
    }),

  revokeSessions: (id: string) => dbArchived.session.deleteMany({ where: { userId: id } }),

  delete: (id: string) => dbArchived.user.delete({ where: { id } }),

  linkFamily: (userId: string, familyId: string, schoolId: string) =>
    dbArchived.userFamily.create({ data: { userId, familyId, schoolId } }),

  unlinkFamily: (userId: string, familyId: string, schoolId: string) =>
    dbArchived.userFamily.deleteMany({
      where: { userId, familyId, schoolId },
    }),

  hasFamilyLink: (userId: string, familyId: string, schoolId: string) =>
    dbArchived.userFamily.findFirst({
      where: { userId, familyId, schoolId },
      select: { userId: true },
    }),
}
