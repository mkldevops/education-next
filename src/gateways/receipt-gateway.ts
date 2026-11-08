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
    data: ({ familyId: string } | { teacherId: string }) & {
      number: number
      total: number
      method: PaymentMethod
      reference: string | null
      paidAt: Date
      recordedById: string | null
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

  /** Rattache au reçu des lignes d'écolage qui n'en portent pas encore. */
  attachPayments: (tx: Tx, schoolId: string, receiptId: string, paymentIds: string[]) =>
    tx.payment.updateMany({
      where: { schoolId, id: { in: paymentIds }, receiptId: null },
      data: { receiptId },
    }),

  /** Lignes d'écolage candidates à un reçu émis après coup. */
  findPaymentsForReceipt: (tx: Tx, schoolId: string, paymentIds: string[]) =>
    tx.payment.findMany({
      where: { schoolId, id: { in: paymentIds } },
      select: {
        id: true,
        familyId: true,
        amount: true,
        method: true,
        reference: true,
        paidAt: true,
        isActive: true,
        receiptId: true,
      },
      orderBy: { id: 'asc' },
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

  /**
   * Rattachements des enfants de ces mois de garderie, archivés compris : une dette facturée
   * reste payable. Passer par le mois facturé laisse le soft-delete de `Student` hors de la
   * lecture sans l'ouvrir aux repas, qui gardent `findStudentFamilies`.
   */
  findChargedStudentFamilies: async (tx: Tx, schoolId: string, chargeIds: string[]) => {
    const charges = await tx.childcareCharge.findMany({
      where: { schoolId, id: { in: chargeIds } },
      select: {
        subscription: {
          select: {
            student: {
              select: {
                id: true,
                person: {
                  select: { families: { select: { familyId: true, relationType: true } } },
                },
              },
            },
          },
        },
      },
    })
    return charges.map((charge) => charge.subscription.student)
  },

  /** Payeur d'un reçu : sa famille, ou le membre du personnel dont il paie la cantine. */
  findPayer: (schoolId: string, id: string) =>
    db.receipt.findUnique({
      where: { id_schoolId: { id, schoolId } },
      select: {
        familyId: true,
        teacherId: true,
        method: true,
        _count: { select: { mealPayments: true } },
      },
    }),

  /** Tient le reçu jusqu'à la fin de `tx` : deux annulations ne se croisent pas. */
  lockForCancel: async (tx: Tx, schoolId: string, id: string) => {
    const rows = await tx.$queryRaw<
      Array<{ familyId: string | null; teacherId: string | null; cancelledAt: Date | null }>
    >`
      SELECT "familyId", "teacherId", "cancelledAt" FROM "Receipt"
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
  /**
   * Jeton du lien public, créé au premier partage puis réutilisé. Un reçu annulé n'en reçoit
   * pas : son lien est mort.
   */
  ensureShareToken: async (schoolId: string, id: string, candidate: string) => {
    await db.receipt.updateMany({
      where: { id, schoolId, shareToken: null, cancelledAt: null },
      data: { shareToken: candidate },
    })
    return db.receipt.findUnique({
      where: { id_schoolId: { id, schoolId } },
      select: { shareToken: true, cancelledAt: true },
    })
  },

  /** Destinataires du reçu par mail : les parents et tuteurs de la famille qui ont une adresse. */
  findFamilyRecipients: (schoolId: string, familyId: string) =>
    db.familyPerson.findMany({
      where: {
        schoolId,
        familyId,
        relationType: { in: ['PARENT', 'TUTOR'] },
        person: { email: { not: null } },
      },
      select: { person: { select: { name: true, email: true } } },
    }),

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
        teacher: { select: { firstName: true, lastName: true } },
        recordedBy: { select: { name: true } },
        payments: {
          select: {
            amount: true,
            enrollment: {
              select: {
                student: { select: { person: { select: { name: true, lastname: true } } } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
        mealPayments: {
          select: {
            amount: true,
            daysAdded: true,
            paidThroughAtReceipt: true,
            account: {
              select: {
                service: true,
                student: { select: { person: { select: { name: true, lastname: true } } } },
                teacher: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
        childcarePayments: {
          select: {
            amount: true,
            charge: {
              select: {
                month: true,
                subscription: {
                  select: {
                    student: { select: { person: { select: { name: true, lastname: true } } } },
                  },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    }),
}
