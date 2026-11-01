import { z } from 'zod'
import { languagesOf } from '@/domain/family'
import { paymentGateway } from '@/gateways/payment-gateway'
import { dbArchived } from '@/lib/db'

const schema = z.object({
  schoolId: z.string().min(1),
  sourceId: z.uuid(),
  targetId: z.uuid(),
})

/** Preserve archived history too. Family locks follow the payment/deletion lock order. */
export async function mergeFamilies(input: z.infer<typeof schema>) {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, sourceId, targetId } = parsed.data
  if (sourceId === targetId) return 'sameFamily' as const

  try {
    return await dbArchived.$transaction(
      async (tx) => {
        for (const id of [sourceId, targetId].sort()) {
          if (!(await paymentGateway.tryLockFamilyCheckout(tx, schoolId, id))) {
            return 'pendingPayment' as const
          }
        }
        await tx.$queryRaw`
        SELECT "id" FROM "Family"
        WHERE "schoolId" = ${schoolId} AND "id" IN (${sourceId}, ${targetId})
        ORDER BY "id" FOR UPDATE
      `
        const families = await tx.family.findMany({
          where: { schoolId, id: { in: [sourceId, targetId] }, isActive: true },
        })
        const source = families.find((family) => family.id === sourceId)
        const target = families.find((family) => family.id === targetId)
        if (!source || !target) return 'notFound' as const
        // A provider checkout may still carry the previous family identifier.
        if (
          await tx.paymentTransaction.count({
            where: { schoolId, familyId: { in: [sourceId, targetId] }, status: 'PENDING' },
          })
        )
          return 'pendingPayment' as const

        const fields = [
          'emergencyContactName',
          'emergencyContactPhone',
          'authorizedPickup',
        ] as const
        if (
          fields.some((field) => source[field] && target[field] && source[field] !== target[field])
        ) {
          return 'familyDetailsConflict' as const
        }
        const links = await tx.familyPerson.findMany({
          where: { schoolId, familyId: { in: [sourceId, targetId] } },
        })
        const targetLinks = new Map(
          links
            .filter((link) => link.familyId === targetId)
            .map((link) => [link.personId, link.relationType])
        )
        const sourceLinks = links.filter((link) => link.familyId === sourceId)
        if (
          sourceLinks.some(
            (link) =>
              targetLinks.has(link.personId) && targetLinks.get(link.personId) !== link.relationType
          )
        )
          return 'relationConflict' as const

        for (const link of sourceLinks) {
          await tx.familyPerson.upsert({
            where: { familyId_personId: { familyId: targetId, personId: link.personId }, schoolId },
            create: {
              schoolId,
              familyId: targetId,
              personId: link.personId,
              relationType: link.relationType,
            },
            update: {},
          })
        }
        const users = await tx.userFamily.findMany({ where: { schoolId, familyId: sourceId } })
        for (const { userId } of users) {
          await tx.userFamily.upsert({
            where: { userId_familyId: { userId, familyId: targetId }, schoolId },
            create: { schoolId, userId, familyId: targetId },
            update: {},
          })
        }
        const where = { schoolId, familyId: sourceId }
        const data = { familyId: targetId }
        await tx.payment.updateMany({ where, data })
        await tx.receipt.updateMany({ where, data })
        await tx.paymentTransaction.updateMany({ where, data })
        await tx.invitation.updateMany({ where, data })
        await tx.familyPerson.deleteMany({ where })
        await tx.userFamily.deleteMany({ where })
        await tx.family.update({
          where: { id_schoolId: { id: targetId, schoolId } },
          data: {
            emergencyContactName: target.emergencyContactName || source.emergencyContactName,
            emergencyContactPhone: target.emergencyContactPhone || source.emergencyContactPhone,
            authorizedPickup: target.authorizedPickup || source.authorizedPickup,
            languagesAtHome: [
              ...new Set([
                ...languagesOf(target.languagesAtHome),
                ...languagesOf(source.languagesAtHome),
              ]),
            ],
          },
        })
        await tx.family.update({
          where: { id_schoolId: { id: sourceId, schoolId } },
          data: { isActive: false },
        })
        return 'OK' as const
      },
      { isolationLevel: 'Serializable' }
    )
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
      return 'mergeConflict' as const
    }
    throw error
  }
}
