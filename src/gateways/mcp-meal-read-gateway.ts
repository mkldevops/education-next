import { db } from '@/lib/db'

/** Explicit projections: receipt hashes, actor identities and internal ledger rows stay private. */
export const mcpMealReadGateway = {
  settings: (schoolId: string) =>
    db.mealServiceSetting.findMany({
      where: { schoolId },
      select: { service: true, isEnabled: true, allowedWeekdays: true },
      orderBy: { service: 'asc' },
    }),
  prices: (schoolId: string) =>
    db.mealPrice.findMany({
      where: { schoolId },
      select: { id: true, service: true, amount: true, effectiveFrom: true },
      orderBy: [{ service: 'asc' }, { effectiveFrom: 'asc' }],
    }),
  familyExists: async (schoolId: string, familyId: string) =>
    (await db.family.count({ where: { schoolId, id: familyId } })) === 1,
  receipts: (schoolId: string, familyId: string, take: number) =>
    db.receipt.findMany({
      where: { schoolId, familyId },
      take,
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        number: true,
        total: true,
        method: true,
        reference: true,
        paidAt: true,
        cancelledAt: true,
        cancelReason: true,
        mealPayments: {
          select: {
            amount: true,
            unitPrice: true,
            daysAdded: true,
            paidThroughAtReceipt: true,
            creditAtReceipt: true,
            account: { select: { studentId: true, service: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
    }),
}
