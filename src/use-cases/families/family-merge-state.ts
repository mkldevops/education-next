import type { Prisma } from '@/generated/prisma/client'

/** The exact membership and access plan an administrator approves before merging. */
export async function readFamilyMergeState(
  tx: Pick<Prisma.TransactionClient, 'family'>,
  schoolId: string,
  sourceId: string,
  targetId: string
) {
  const families = await tx.family.findMany({
    where: { schoolId, id: { in: [sourceId, targetId] }, isActive: true },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      persons: {
        orderBy: { personId: 'asc' },
        select: {
          personId: true,
          relationType: true,
          person: {
            select: {
              name: true,
              lastname: true,
              isActive: true,
              student: { select: { id: true, isActive: true } },
            },
          },
        },
      },
      users: {
        orderBy: { userId: 'asc' },
        select: { userId: true, user: { select: { name: true } } },
      },
      invitations: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          email: true,
          role: true,
          personId: true,
          usedAt: true,
          expiresAt: true,
        },
      },
      _count: { select: { payments: true, receipts: true, paymentTransactions: true } },
    },
  })
  const describe = (family: (typeof families)[number]) => ({
    id: family.id,
    name: family.name,
    version: family.updatedAt.toISOString(),
    members: family.persons.map(({ personId, relationType, person }) => ({
      personId,
      relationType,
      name: person.name,
      lastname: person.lastname,
      active: person.isActive,
      student: person.student,
    })),
    accounts: family.users.map(({ userId, user }) => ({ userId, name: user.name })),
    invitations: family.invitations.map((invitation) => ({
      ...invitation,
      usedAt: invitation.usedAt?.toISOString() ?? null,
      expiresAt: invitation.expiresAt.toISOString(),
    })),
    history: family._count,
  })
  const source = families.find((family) => family.id === sourceId)
  const target = families.find((family) => family.id === targetId)
  return source && target ? { source: describe(source), target: describe(target) } : null
}
