import { OPEN_ENROLLMENT_STATUSES } from '@/domain/enrollment'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'

export const planGateway = {
  create: (schoolId: string, data: { name: string; amount: number }) =>
    db.plan.create({ data: { ...data, schoolId } }),

  update: (
    schoolId: string,
    id: string,
    data: {
      name?: string
      amount?: number
    }
  ) =>
    db.plan.update({
      where: { id_schoolId: { id, schoolId } },
      data,
    }),

  findById: (schoolId: string, id: string) =>
    db.plan.findUnique({
      where: { id_schoolId: { id, schoolId } },
    }),

  countOpenEnrollments: (schoolId: string, id: string) =>
    db.enrollment.count({
      where: { schoolId, planId: id, status: { in: [...OPEN_ENROLLMENT_STATUSES] } },
    }),

  deactivate: (schoolId: string, id: string) =>
    db.plan.update({
      where: { id_schoolId: { id, schoolId } },
      data: { isActive: false },
    }),

  /**
   * Formule réservée « sans tarif » de l'école, montant nul, créée à la demande (FR-018) :
   * jamais à la création de l'école, seulement à la première inscription posée pendant une
   * coupure des paiements. Trouve avant de créer plutôt qu'un `upsert` : le contrat exposé
   * est « trouver-ou-créer », dans la transaction que l'appelant a ouverte quand il en
   * fournit une — `create-enrollment.ts` recalcule alors le solde de la formule dans le même
   * commit que l'inscription qu'elle sert.
   */
  ensureUnpriced: async (schoolId: string, client: Prisma.TransactionClient = db) => {
    const existing = await client.plan.findFirst({
      where: { schoolId, name: UNPRICED_PLAN_NAME },
    })
    if (existing) return existing

    return client.plan.create({
      data: { schoolId, name: UNPRICED_PLAN_NAME, amount: 0 },
    })
  },
}
