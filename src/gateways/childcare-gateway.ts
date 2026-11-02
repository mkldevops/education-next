import { chargeRemaining, dateToMonth, monthToDate } from '@/domain/childcare'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

type Tx = Prisma.TransactionClient

const toSubscription = (row: {
  id: string
  monthlyAmount: Prisma.Decimal
  startMonth: Date
  endMonth: Date | null
}) => ({
  id: row.id,
  monthlyAmount: Number(row.monthlyAmount),
  startMonth: dateToMonth(row.startMonth),
  endMonth: row.endMonth ? dateToMonth(row.endMonth) : null,
})

/** Encaissé par mois facturé, reçus annulés exclus. */
async function sumPaid(
  client: Pick<Tx, 'childcarePayment'>,
  schoolId: string,
  chargeIds: string[]
) {
  if (chargeIds.length === 0) return new Map<string, number>()
  const rows = await client.childcarePayment.groupBy({
    by: ['chargeId'],
    where: { schoolId, chargeId: { in: chargeIds }, receipt: { cancelledAt: null } },
    _sum: { amount: true },
  })
  return new Map(rows.map((row) => [row.chargeId, Number(row._sum.amount ?? 0)]))
}

/**
 * `satisfies` contrôle les champs imbriqués : le typage générique de Prisma ne vérifie que le
 * premier niveau d'un `select` écrit en argument, un champ inconnu plus bas n'y casse qu'à
 * l'exécution.
 */
const studentSearchSelect = {
  id: true,
  person: { select: { name: true, lastname: true } },
  enrollments: {
    where: { status: { in: ['PENDING', 'ACTIVE'] } },
    select: {
      classAssignments: {
        where: { endAt: null },
        select: { classPeriod: { select: { name: true } } },
        take: 1,
      },
    },
  },
} satisfies Prisma.StudentSelect

export const childcareGateway = {
  transaction: <T>(fn: (tx: Tx) => Promise<T>) => db.$transaction(fn),

  /** Élève actif de l'école : la garderie ne s'ouvre pas pour un élève archivé. */
  studentExists: async (tx: Tx, schoolId: string, studentId: string) =>
    (await tx.student.count({ where: { id: studentId, schoolId, isActive: true } })) > 0,

  /** Tient la garderie d'un enfant, si elle existe, jusqu'à la fin de `tx`. */
  lockStudentSubscription: async (tx: Tx, schoolId: string, studentId: string) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ChildcareSubscription"
      WHERE "schoolId" = ${schoolId} AND "studentId" = ${studentId}
      FOR NO KEY UPDATE`
    return rows[0]?.id ?? null
  },

  /** Mois encore facturés de la garderie, pour refuser une période qui les exclurait. */
  listLiveMonths: async (tx: Tx, schoolId: string, subscriptionId: string) => {
    const rows = await tx.childcareCharge.findMany({
      where: { schoolId, subscriptionId, cancelledAt: null },
      select: { month: true },
    })
    return rows.map((row) => dateToMonth(row.month))
  },

  upsertSubscription: (
    tx: Tx,
    schoolId: string,
    data: {
      studentId: string
      monthlyAmount: number
      startMonth: string
      endMonth: string | null
    }
  ) => {
    const values = {
      monthlyAmount: data.monthlyAmount,
      startMonth: monthToDate(data.startMonth),
      endMonth: data.endMonth ? monthToDate(data.endMonth) : null,
    }
    return tx.childcareSubscription.upsert({
      where: { schoolId_studentId: { schoolId, studentId: data.studentId } },
      create: { ...values, schoolId, studentId: data.studentId },
      update: values,
      select: { id: true },
    })
  },

  /** Un mois vivant ou déjà encaissé, même sur un reçu annulé, retient la garderie. */
  hasBillingHistory: async (tx: Tx, schoolId: string, subscriptionId: string) =>
    (await tx.childcareCharge.count({
      where: {
        schoolId,
        subscriptionId,
        OR: [{ cancelledAt: null }, { payments: { some: {} } }],
      },
    })) > 0,

  deleteSubscription: (tx: Tx, schoolId: string, id: string) =>
    tx.childcareSubscription.delete({ where: { id_schoolId: { id, schoolId } } }),

  /** Garderies facturables, verrouillées dans l'ordre des ids. Un élève archivé en sort. */
  lockBillableSubscriptions: async (tx: Tx, schoolId: string) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string
        monthlyAmount: Prisma.Decimal
        startMonth: Date
        endMonth: Date | null
      }>
    >`
      SELECT s."id", s."monthlyAmount", s."startMonth", s."endMonth"
      FROM "ChildcareSubscription" s
      JOIN "Student" st ON st."id" = s."studentId" AND st."schoolId" = s."schoolId"
      WHERE s."schoolId" = ${schoolId} AND st."isActive" = true
      ORDER BY s."id"
      FOR NO KEY UPDATE OF s`
    return rows.map(toSubscription)
  },

  listMonthCharges: (tx: Tx, schoolId: string, month: string, subscriptionIds: string[]) =>
    tx.childcareCharge.findMany({
      where: { schoolId, month: monthToDate(month), subscriptionId: { in: subscriptionIds } },
      select: { id: true, subscriptionId: true, cancelledAt: true },
    }),

  createCharges: (
    tx: Tx,
    schoolId: string,
    month: string,
    recordedById: string,
    rows: ReadonlyArray<{ subscriptionId: string; amount: number }>
  ) =>
    tx.childcareCharge.createMany({
      data: rows.map((row) => ({
        ...row,
        schoolId,
        month: monthToDate(month),
        recordedById,
      })),
    }),

  reviveCharge: (tx: Tx, schoolId: string, id: string, recordedById: string, amount: number) =>
    tx.childcareCharge.update({
      where: { id_schoolId: { id, schoolId } },
      data: { amount, recordedById, cancelledAt: null, cancelledById: null, cancelReason: null },
    }),

  /**
   * Mois facturés d'un encaissement ou d'une annulation, verrouillés dans l'ordre des ids :
   * après les comptes repas, avant le compteur de reçus. Rendus avec ce qu'il en reste à payer.
   */
  lockCharges: async (tx: Tx, schoolId: string, ids: string[]) => {
    if (ids.length === 0) return []
    const locked = await tx.$queryRaw<
      Array<{ id: string; studentId: string; amount: Prisma.Decimal; cancelledAt: Date | null }>
    >`
      SELECT c."id", s."studentId", c."amount", c."cancelledAt"
      FROM "ChildcareCharge" c
      JOIN "ChildcareSubscription" s ON s."id" = c."subscriptionId"
      WHERE c."schoolId" = ${schoolId} AND c."id" = ANY(${ids})
      ORDER BY c."id"
      FOR NO KEY UPDATE OF c`
    const paid = await sumPaid(tx, schoolId, ids)
    return locked.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      cancelled: row.cancelledAt !== null,
      remaining: chargeRemaining(Number(row.amount), paid.get(row.id) ?? 0),
      paid: paid.get(row.id) ?? 0,
    }))
  },

  cancelCharge: (
    tx: Tx,
    schoolId: string,
    id: string,
    data: { cancelledById: string; cancelReason: string }
  ) =>
    tx.childcareCharge.update({
      where: { id_schoolId: { id, schoolId } },
      data: { ...data, cancelledAt: new Date() },
    }),

  /** Lignes garderie d'un reçu. */
  createPayments: (
    tx: Tx,
    schoolId: string,
    receiptId: string,
    lines: ReadonlyArray<{ chargeId: string; amount: number }>
  ) =>
    tx.childcarePayment.createMany({
      data: lines.map((line) => ({ ...line, schoolId, receiptId })),
    }),

  /** Mois restant à encaisser pour ces enfants, le plus ancien d'abord. */
  listOpenCharges: async (schoolId: string, studentIds: string[]) => {
    if (studentIds.length === 0) return []
    const charges = await db.childcareCharge.findMany({
      where: {
        schoolId,
        cancelledAt: null,
        subscription: { studentId: { in: studentIds } },
      },
      select: {
        id: true,
        month: true,
        amount: true,
        subscription: { select: { studentId: true } },
      },
      orderBy: { month: 'asc' },
    })
    const paid = await sumPaid(
      db,
      schoolId,
      charges.map((charge) => charge.id)
    )
    return charges.flatMap((charge) => {
      const remaining = chargeRemaining(Number(charge.amount), paid.get(charge.id) ?? 0)
      return remaining > 0
        ? [
            {
              chargeId: charge.id,
              studentId: charge.subscription.studentId,
              month: dateToMonth(charge.month),
              amount: Number(charge.amount),
              remaining,
            },
          ]
        : []
    })
  },

  /** Écran garderie : chaque enfant, sa période et ses mois facturés. */
  listSubscriptions: async (schoolId: string) => {
    const rows = await db.childcareSubscription.findMany({
      where: { schoolId },
      select: {
        id: true,
        monthlyAmount: true,
        startMonth: true,
        endMonth: true,
        student: {
          select: {
            id: true,
            isActive: true,
            person: {
              select: {
                name: true,
                lastname: true,
                families: {
                  select: {
                    familyId: true,
                    relationType: true,
                    family: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        charges: {
          select: { id: true, month: true, amount: true, cancelledAt: true },
          orderBy: { month: 'asc' },
        },
      },
    })
    const paid = await sumPaid(
      db,
      schoolId,
      rows.flatMap((row) => row.charges.map((charge) => charge.id))
    )
    return rows.map((row) => ({
      ...toSubscription(row),
      student: row.student,
      charges: row.charges.map((charge) => ({
        id: charge.id,
        month: dateToMonth(charge.month),
        amount: Number(charge.amount),
        paid: paid.get(charge.id) ?? 0,
        cancelled: charge.cancelledAt !== null,
      })),
    }))
  },

  /** Élèves actifs à rattacher : la classe courante lève les homonymes. */
  searchStudents: (schoolId: string, query: string) => {
    const match = { contains: query, mode: 'insensitive' as const }
    return db.student.findMany({
      where: {
        schoolId,
        isActive: true,
        person: { OR: [{ name: match }, { lastname: match }] },
      },
      select: studentSearchSelect,
      orderBy: { person: { lastname: 'asc' } },
      take: 20,
    })
  },
}
