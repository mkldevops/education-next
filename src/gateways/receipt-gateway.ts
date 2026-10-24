import type { PaymentMethod, Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

type Tx = Prisma.TransactionClient

const toDbDate = (day: string) => new Date(`${day}T00:00:00.000Z`)

export const receiptGateway = {
  transaction: <T>(fn: (tx: Tx) => Promise<T>) => db.$transaction(fn),

  findByIdempotencyKey: (schoolId: string, idempotencyKey: string) =>
    db.receipt.findUnique({
      where: { schoolId_idempotencyKey: { schoolId, idempotencyKey } },
      select: { id: true, requestHash: true },
    }),

  /**
   * Numéro suivant de l'école, sans trou tant que la transaction aboutit : la ligne du
   * compteur reste tenue jusqu'au commit, une seconde caisse attend son tour.
   */
  nextNumber: async (tx: Tx, schoolId: string) => {
    const rows = await tx.$queryRaw<Array<{ number: number }>>`
      INSERT INTO "ReceiptCounter" ("schoolId", "next") VALUES (${schoolId}, 2)
      ON CONFLICT ("schoolId") DO UPDATE SET "next" = "ReceiptCounter"."next" + 1
      RETURNING "next" - 1 AS "number"`
    return rows[0].number
  },

  create: (
    tx: Tx,
    schoolId: string,
    data: {
      familyId: string
      number: number
      total: number
      method: PaymentMethod
      reference: string | null
      paidAt: Date
      recordedById: string
      idempotencyKey: string
      requestHash: string
    }
  ) => tx.receipt.create({ data: { ...data, schoolId }, select: { id: true } }),

  createMealPayments: (
    tx: Tx,
    schoolId: string,
    receiptId: string,
    lines: ReadonlyArray<{
      accountId: string
      amount: number
      unitPrice: number
      daysAdded: number
      paidThroughAtReceipt: string | null
      creditAtReceipt: number
    }>
  ) =>
    tx.mealPayment.createMany({
      data: lines.map(({ paidThroughAtReceipt, ...line }) => ({
        ...line,
        schoolId,
        receiptId,
        paidThroughAtReceipt: paidThroughAtReceipt === null ? null : toDbDate(paidThroughAtReceipt),
      })),
    }),

  /** Rattachements familiaux des élèves d'un encaissement, pour en vérifier la famille redevable. */
  findStudentFamilies: (tx: Tx, schoolId: string, studentIds: string[]) =>
    tx.student.findMany({
      where: { schoolId, id: { in: studentIds } },
      select: {
        id: true,
        person: { select: { families: { select: { familyId: true, relationType: true } } } },
      },
    }),

  findFamilyId: async (schoolId: string, id: string) =>
    (
      await db.receipt.findUnique({
        where: { id_schoolId: { id, schoolId } },
        select: { familyId: true },
      })
    )?.familyId ?? null,

  /** Tient le reçu jusqu'à la fin de `tx` : deux annulations ne se croisent pas. */
  lockForCancel: async (tx: Tx, schoolId: string, id: string) => {
    const rows = await tx.$queryRaw<Array<{ familyId: string; cancelledAt: Date | null }>>`
      SELECT "familyId", "cancelledAt" FROM "Receipt"
      WHERE "id" = ${id} AND "schoolId" = ${schoolId}
      FOR UPDATE`
    return rows[0] ?? null
  },

  /** Règlements d'écolage actifs portés par le reçu. */
  findActivePayments: (tx: Tx, schoolId: string, receiptId: string) =>
    tx.payment.findMany({
      where: { schoolId, receiptId },
      select: { id: true, enrollmentId: true },
    }),

  markCancelled: (
    tx: Tx,
    schoolId: string,
    id: string,
    data: { cancelledById: string; cancelReason: string }
  ) =>
    tx.receipt.update({
      where: { id_schoolId: { id, schoolId } },
      data: { ...data, cancelledAt: new Date() },
    }),

  /** Reçu à afficher ou partager, avec ses lignes. */
  findForDisplay: (schoolId: string, id: string) =>
    db.receipt.findUnique({
      where: { id_schoolId: { id, schoolId } },
      select: {
        id: true,
        number: true,
        total: true,
        method: true,
        reference: true,
        paidAt: true,
        cancelledAt: true,
        cancelReason: true,
        family: { select: { id: true, name: true } },
        recordedBy: { select: { name: true } },
        mealPayments: {
          select: {
            amount: true,
            daysAdded: true,
            paidThroughAtReceipt: true,
            account: {
              select: {
                service: true,
                student: { select: { person: { select: { name: true, lastname: true } } } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    }),
}
