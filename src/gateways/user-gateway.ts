import { db, dbArchived } from '@/lib/db'
import type { Role } from '@/types/enums'

const listSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  role: true,
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
      select: { id: true, role: true, isActive: true, email: true },
    }),

  findByEmail: (email: string) =>
    dbArchived.user.findUnique({
      where: { email },
      select: { id: true },
    }),

  countActiveSuperAdmins: () =>
    dbArchived.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } }),

  listAll: () =>
    dbArchived.user.findMany({
      select: {
        ...listSelect,
        families: {
          select: { family: { select: { id: true, name: true, isActive: true } } },
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
        _count: { select: { sessions: true, passkeys: true, accounts: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

  findDetail: (id: string) =>
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
          select: { id: true, email: true, role: true, createdAt: true, usedAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            sessions: true,
            passkeys: true,
            accounts: true,
            createdFamilies: true,
            createdInvitations: true,
            paymentTransactions: true,
          },
        },
      },
    }),

  countBlockingRelations: async (id: string) => {
    const [createdFamilies, createdInvitations, paymentTransactions] = await Promise.all([
      dbArchived.family.count({ where: { createdById: id } }),
      dbArchived.invitation.count({ where: { createdById: id } }),
      dbArchived.paymentTransaction.count({ where: { initiatedById: id } }),
    ])
    return createdFamilies + createdInvitations + paymentTransactions
  },

  update: (id: string, data: { name?: string | null; email?: string; emailVerified?: boolean }) =>
    dbArchived.user.update({ where: { id }, data, select: listSelect }),

  changeRole: (id: string, role: Role) =>
    dbArchived.user.update({ where: { id }, data: { role }, select: listSelect }),

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

  linkFamily: (userId: string, familyId: string) =>
    dbArchived.userFamily.create({ data: { userId, familyId } }),

  unlinkFamily: (userId: string, familyId: string) =>
    dbArchived.userFamily.delete({ where: { userId_familyId: { userId, familyId } } }),

  hasFamilyLink: (userId: string, familyId: string) =>
    dbArchived.userFamily.findUnique({
      where: { userId_familyId: { userId, familyId } },
      select: { userId: true },
    }),
}
