import type { PaymentMethod, Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { tryAcquireAdvisoryLock } from './advisory-lock'

type PaymentData = {
  familyId: string
  enrollmentId: string
  amount: number
  method: PaymentMethod
  reference?: string
  paidAt: Date
  cashedAt?: Date
}

export const paymentGateway = {
  create: (schoolId: string, data: PaymentData) =>
    db.payment.create({ data: { ...data, schoolId } }),

  /**
   * Sérialise les encaissements d'une famille jusqu'à la fin de `tx`.
   *
   * Le solde se lit puis s'écrit : sans verrou, deux saisies de 720 € sur un solde de 720 €
   * lisent chacune 720 € restants et encaissent 1 440 €. La ligne `Family` sert de verrou,
   * scopée par école comme toute requête racine — le garde tenant ne voit pas le SQL brut.
   * `FOR NO KEY UPDATE` exclut un second encaissement sans bloquer les insertions qui
   * référencent la famille (leur `FOR KEY SHARE` n'entre pas en conflit).
   *
   * Rend `false` quand la famille n'existe pas, est archivée ou appartient à une autre école.
   */
  lockFamilyForPayment: async (
    tx: Prisma.TransactionClient,
    schoolId: string,
    familyId: string
  ) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Family"
      WHERE "id" = ${familyId} AND "schoolId" = ${schoolId} AND "isActive" = true
      FOR NO KEY UPDATE`
    return rows.length === 1
  },

  /**
   * Réserve l'ouverture d'une session Checkout de la famille jusqu'à la fin de `tx`.
   *
   * Verrou consultatif distinct de `lockFamilyForPayment` : il est tenu pendant les appels
   * Stripe, et ne doit donc bloquer ni la saisie manuelle ni le webhook qui encaisse. Les
   * deux verrous ne sont jamais pris dans la même transaction : aucun interblocage possible.
   * Sans attente : une demande concurrente échoue au lieu d'immobiliser une connexion.
   *
   * Rend `false` quand une autre ouverture est en cours pour cette famille.
   */
  tryLockFamilyCheckout: (tx: Prisma.TransactionClient, schoolId: string, familyId: string) =>
    tryAcquireAdvisoryLock(tx, `checkout:${schoolId}:${familyId}`),

  /** Écrit une ligne par inscription, dans la transaction qui a relu le solde. */
  createForFamily: async (
    tx: Prisma.TransactionClient,
    schoolId: string,
    payments: PaymentData[]
  ) => {
    const ids: string[] = []
    for (const data of payments) {
      const payment = await tx.payment.create({
        data: { ...data, schoolId },
        select: { id: true },
      })
      ids.push(payment.id)
    }
    return ids
  },

  findActiveByIds: (tx: Prisma.TransactionClient, schoolId: string, ids: string[]) =>
    tx.payment.findMany({
      where: { schoolId, id: { in: ids } },
      select: {
        id: true,
        familyId: true,
        enrollmentId: true,
        amount: true,
        paymentTransactionId: true,
      },
    }),

  /**
   * Encaissé actif par inscription, sans les paiements `excludedIds` : ce que chaque
   * inscription aurait encore reçu une fois ceux-ci désactivés. `groupBy` n'est pas couvert
   * par le soft-delete du client, d'où le filtre `isActive` explicite. Une inscription sans
   * autre paiement actif n'a pas de ligne : elle vaut zéro.
   */
  sumActiveByEnrollment: async (
    tx: Prisma.TransactionClient,
    schoolId: string,
    enrollmentIds: string[],
    excludedIds: string[]
  ) => {
    const rows = await tx.payment.groupBy({
      by: ['enrollmentId'],
      where: {
        schoolId,
        enrollmentId: { in: enrollmentIds },
        id: { notIn: excludedIds },
        isActive: true,
      },
      _sum: { amount: true },
    })
    return new Map(rows.map((row) => [row.enrollmentId, Number(row._sum.amount ?? 0)]))
  },

  /** Désactive, ne supprime pas : l'encaissement annulé reste lisible pour l'audit. */
  deactivateMany: (tx: Prisma.TransactionClient, schoolId: string, ids: string[]) =>
    tx.payment.updateMany({
      where: { schoolId, id: { in: ids } },
      data: { isActive: false },
    }),

  listByFamily: (schoolId: string, familyId: string) =>
    db.payment.findMany({
      where: { schoolId, familyId },
      include: { enrollment: true },
      orderBy: { paidAt: 'desc' },
    }),

  listByEnrollment: (schoolId: string, enrollmentId: string) =>
    db.payment.findMany({
      where: { schoolId, enrollmentId },
      orderBy: { paidAt: 'desc' },
    }),

  list: (schoolId: string) =>
    db.payment.findMany({
      where: { schoolId, enrollment: { isActive: true } },
      include: { enrollment: true },
      orderBy: { paidAt: 'desc' },
    }),

  /**
   * `Payment.reference` n'est ni unique ni obligatoire en base : un numéro de reçu
   * ressaisi ne heurte aucune contrainte. C'est ce que le `preview_*` MCP signale.
   */
  findByReference: (schoolId: string, reference: string) =>
    db.payment.findMany({
      where: { schoolId, reference },
      select: { id: true, amount: true, paidAt: true },
      orderBy: { paidAt: 'desc' },
      take: 10,
    }),

  calculateBalance: async (schoolId: string, enrollmentId: string) => {
    const result = await db.payment.aggregate({
      where: { schoolId, enrollmentId },
      _sum: { amount: true },
    })
    return Number(result._sum.amount ?? 0)
  },

  /**
   * Ce que la désactivation des paiements va rendre invisible. Les deux comptages
   * partent ensemble pour que la confirmation énumère, au lieu de laisser
   * l'administrateur deviner.
   */
  countFootprint: async (schoolId: string) => {
    const [payments, pendingTransactions] = await Promise.all([
      db.payment.count({ where: { schoolId } }),
      db.paymentTransaction.count({ where: { schoolId, status: 'PENDING' } }),
    ])

    return { payments, pendingTransactions }
  },
}
