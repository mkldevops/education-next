import { z } from 'zod'
import { paymentGateway } from '@/gateways/payment-gateway'
import type { Prisma } from '@/generated/prisma/client'
import { dbArchived } from '@/lib/db'
import { formatAmount, toNumber } from '@/lib/decimal'
import { draftChecksum } from '@/lib/mcp-draft-crypto'

export const splitFamilyFieldsSchema = z.object({
  sourceId: z.uuid(),
  personIds: z.array(z.uuid()).min(1).max(20),
  name: z.string().trim().min(1).max(50),
})

const schema = splitFamilyFieldsSchema.extend({
  schoolId: z.string().min(1),
  createdById: z.string().min(1),
})

type Input = z.infer<typeof schema>
type InspectInput = Pick<Input, 'schoolId' | 'sourceId' | 'personIds'>

type Client = Pick<
  Prisma.TransactionClient,
  'family' | 'familyPerson' | 'payment' | 'receipt' | 'paymentTransaction' | 'invitation'
>

const sorted = (ids: Iterable<string>) => [...new Set(ids)].sort()

/** Classify a record by the students it concerns: all moved, none moved, or both. */
function side(studentIds: Array<string | null | undefined>, moved: Set<string>) {
  const known = studentIds.filter((id): id is string => Boolean(id))
  const inMoved = known.filter((id) => moved.has(id)).length
  if (inMoved === 0) return 'stay' as const
  return inMoved === known.length ? ('move' as const) : ('mixed' as const)
}

/**
 * Resolve which members, payments, receipts, checkouts and invitations leave the source
 * family. A record that concerns both moved and remaining students cannot be split, so it
 * blocks the operation instead of silently staying with one of the two debtors.
 */
export async function inspectFamilySplit(
  tx: Client,
  { schoolId, sourceId, personIds }: InspectInput
) {
  const source = await tx.family.findFirst({ where: { schoolId, id: sourceId, isActive: true } })
  if (!source) return 'notFound' as const
  if (
    await tx.paymentTransaction.count({
      where: { schoolId, familyId: sourceId, status: 'PENDING' },
    })
  )
    return 'pendingPayment' as const

  const links = await tx.familyPerson.findMany({
    where: { schoolId, familyId: sourceId },
    orderBy: { personId: 'asc' },
    include: {
      person: { select: { name: true, lastname: true, student: { select: { id: true } } } },
    },
  })
  const wanted = new Set(personIds)
  const movedLinks = links.filter((link) => wanted.has(link.personId))
  if (movedLinks.length !== wanted.size) return 'memberNotFound' as const
  if (movedLinks.length === links.length) return 'nothingRemains' as const
  if (
    await tx.familyPerson.findFirst({
      where: { schoolId, personId: { in: [...wanted] }, familyId: { not: sourceId } },
      select: { personId: true },
    })
  )
    return 'sharedMember' as const

  const movedStudents = new Set(
    movedLinks.flatMap((link) => (link.person.student ? [link.person.student.id] : []))
  )

  const payments = await tx.payment.findMany({
    where: { schoolId, familyId: sourceId },
    select: { id: true, amount: true, enrollment: { select: { studentId: true } } },
  })
  const movedPayments = payments.filter((payment) =>
    movedStudents.has(payment.enrollment.studentId)
  )

  const receipts = await tx.receipt.findMany({
    where: { schoolId, familyId: sourceId },
    select: {
      id: true,
      payments: { select: { enrollment: { select: { studentId: true } } } },
      mealPayments: { select: { account: { select: { studentId: true } } } },
      childcarePayments: {
        select: { charge: { select: { subscription: { select: { studentId: true } } } } },
      },
    },
  })
  const receiptIds: string[] = []
  for (const receipt of receipts) {
    const verdict = side(
      [
        ...receipt.payments.map((line) => line.enrollment.studentId),
        ...receipt.mealPayments.map((line) => line.account.studentId),
        ...receipt.childcarePayments.map((line) => line.charge.subscription.studentId),
      ],
      movedStudents
    )
    if (verdict === 'mixed') return 'sharedReceipt' as const
    if (verdict === 'move') receiptIds.push(receipt.id)
  }

  const transactions = await tx.paymentTransaction.findMany({
    where: { schoolId, familyId: sourceId },
    select: {
      id: true,
      allocations: { select: { enrollment: { select: { studentId: true } } } },
    },
  })
  const transactionIds: string[] = []
  for (const transaction of transactions) {
    const verdict = side(
      transaction.allocations.map((payment) => payment.enrollment.studentId),
      movedStudents
    )
    if (verdict === 'mixed') return 'sharedTransaction' as const
    if (verdict === 'move') transactionIds.push(transaction.id)
  }

  const invitations = await tx.invitation.findMany({
    where: { schoolId, familyId: sourceId, personId: { in: [...wanted] } },
    select: { id: true },
  })

  return {
    plan: {
      source: { id: source.id, name: source.name, version: source.updatedAt.toISOString() },
      remaining: links
        .filter((link) => !wanted.has(link.personId))
        .map((link) => ({
          personId: link.personId,
          name: link.person.name,
          lastname: link.person.lastname,
        })),
      moved: movedLinks.map((link) => ({
        personId: link.personId,
        relationType: link.relationType,
        name: link.person.name,
        lastname: link.person.lastname,
        studentId: link.person.student?.id ?? null,
      })),
      paymentIds: sorted(movedPayments.map((payment) => payment.id)),
      movedPaidAmount: formatAmount(
        movedPayments.reduce((total, payment) => total + toNumber(payment.amount), 0)
      ),
      receiptIds: sorted(receiptIds),
      transactionIds: sorted(transactionIds),
      invitationIds: sorted(invitations.map((invitation) => invitation.id)),
    },
  }
}

export type FamilySplitPlan = Exclude<
  Awaited<ReturnType<typeof inspectFamilySplit>>,
  string
>['plan']

export const familySplitChecksum = (plan: FamilySplitPlan) => draftChecksum(plan)

/**
 * Move some members of a family into a new family, with the payments, receipts, checkouts and
 * invitations that concern them. Parent accounts stay with the source family.
 */
export async function splitFamily(
  input: Input,
  options: { transaction?: Prisma.TransactionClient; expectedStateChecksum?: string } = {}
) {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, sourceId, name, createdById } = parsed.data

  try {
    const run = async (tx: Prisma.TransactionClient) => {
      if (!(await paymentGateway.tryLockFamilyCheckout(tx, schoolId, sourceId))) {
        return 'pendingPayment' as const
      }
      await tx.$queryRaw`
        SELECT "id" FROM "Family"
        WHERE "schoolId" = ${schoolId} AND "id" = ${sourceId}
        FOR UPDATE
      `
      const inspection = await inspectFamilySplit(tx, parsed.data)
      if (typeof inspection === 'string') return inspection
      const { plan } = inspection
      if (
        options.expectedStateChecksum !== undefined &&
        familySplitChecksum(plan) !== options.expectedStateChecksum
      )
        return 'staleDraft' as const

      const family = await tx.family.create({ data: { schoolId, name, createdById } })
      const personIds = plan.moved.map((member) => member.personId)
      for (const member of plan.moved) {
        await tx.familyPerson.create({
          data: {
            schoolId,
            familyId: family.id,
            personId: member.personId,
            relationType: member.relationType,
          },
        })
      }
      await tx.familyPerson.deleteMany({
        where: { schoolId, familyId: sourceId, personId: { in: personIds } },
      })
      const data = { familyId: family.id }
      const scoped = (ids: string[]) => ({ schoolId, familyId: sourceId, id: { in: ids } })
      await tx.payment.updateMany({ where: scoped(plan.paymentIds), data })
      await tx.receipt.updateMany({ where: scoped(plan.receiptIds), data })
      await tx.paymentTransaction.updateMany({ where: scoped(plan.transactionIds), data })
      await tx.invitation.updateMany({ where: scoped(plan.invitationIds), data })
      await tx.family.update({
        where: { id_schoolId: { id: sourceId, schoolId } },
        data: { updatedAt: new Date() },
      })
      return { familyId: family.id, name: family.name }
    }
    return options.transaction
      ? await run(options.transaction)
      : await dbArchived.$transaction(run, { isolationLevel: 'ReadCommitted' })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
      return 'splitConflict' as const
    }
    throw error
  }
}
