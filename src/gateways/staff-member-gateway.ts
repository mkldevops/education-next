import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

type Tx = Prisma.TransactionClient

const staffSelect = {
  id: true,
  name: true,
  note: true,
  mealExempt: true,
  isActive: true,
} as const

export const staffMemberGateway = {
  /** Personnel de l'école, actifs d'abord puis par nom. */
  list: (schoolId: string) =>
    db.staffMember.findMany({
      where: { schoolId },
      select: staffSelect,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),

  find: (schoolId: string, id: string) =>
    db.staffMember.findUnique({ where: { id_schoolId: { id, schoolId } }, select: staffSelect }),

  create: (schoolId: string, data: { name: string; note: string | null; mealExempt: boolean }) =>
    db.staffMember.create({ data: { ...data, schoolId }, select: { id: true } }),

  update: async (
    schoolId: string,
    id: string,
    data: { name: string; note: string | null; mealExempt: boolean; isActive: boolean }
  ) => (await db.staffMember.updateMany({ where: { id, schoolId }, data })).count === 1,

  /** Relu sous la transaction d'un encaissement : une exemption posée entre-temps l'emporte. */
  findForReceipt: (tx: Tx, schoolId: string, id: string) =>
    tx.staffMember.findUnique({
      where: { id_schoolId: { id, schoolId } },
      select: { isActive: true, mealExempt: true },
    }),
}
