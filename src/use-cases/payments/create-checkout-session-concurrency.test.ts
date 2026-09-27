// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { configGateway } from '@/gateways/config-gateway'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'

type FakeSession = { id: string; status: 'open' | 'expired' }

const sessions = new Map<string, FakeSession>()
let sessionCount = 0
const runId = Date.now().toString(36)
const stripeLatency = () => new Promise((resolve) => setTimeout(resolve, 50))
let releaseCreate: () => void = () => undefined
let createGate: Promise<void> = Promise.resolve()
const fakeStripe = {
  checkout: {
    sessions: {
      create: async () => {
        await createGate
        sessionCount += 1
        const session: FakeSession = { id: `cs_race_${runId}_${sessionCount}`, status: 'open' }
        sessions.set(session.id, session)
        return { ...session, url: `https://checkout.stripe.test/${session.id}` }
      },
      retrieve: async (id: string) => {
        await stripeLatency()
        return { ...sessions.get(id) }
      },
      expire: async (id: string) => {
        await stripeLatency()
        const session = sessions.get(id)
        if (session) session.status = 'expired'
        return { ...session }
      },
    },
  },
}

vi.mock('@/lib/stripe', () => ({ getStripeClient: () => fakeStripe }))

const { createCheckoutSession } = await import('./create-checkout-session')

const databaseUrl = process.env.DATABASE_URL
const paymentsEnabled = {
  get: async () => ({ value: 'true' }),
} as unknown as typeof configGateway

let raw: PrismaClient
let schoolId: string
let familyId: string
let adminId: string

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('createCheckoutSession concurrency', () => {
  beforeAll(async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_race')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_race')
    raw = createUnguardedArchivedClient()
    const suffix = `${Date.now().toString(36)}-checkout-lock`
    const school = await raw.school.create({
      data: { name: `checkout lock ${suffix}`, slug: `checkout-lock-${suffix}` },
    })
    schoolId = school.id

    const admin = await raw.user.create({ data: { email: `admin-${suffix}@payment.test` } })
    adminId = admin.id
    const plan = await raw.plan.create({ data: { schoolId, name: `plan ${suffix}`, amount: 720 } })
    const family = await raw.family.create({
      data: { schoolId, name: 'Famille Checkout', createdById: admin.id },
    })
    familyId = family.id
    const person = await raw.person.create({
      data: { schoolId, name: 'Yanis', lastname: 'Checkout' },
    })
    await raw.familyPerson.create({
      data: { schoolId, familyId, personId: person.id, relationType: 'PARENT' },
    })
    const student = await raw.student.create({ data: { schoolId, personId: person.id } })
    await raw.enrollment.create({
      data: {
        schoolId,
        studentId: student.id,
        planId: plan.id,
        totalAmount: 720,
        status: 'ACTIVE',
      },
    })
  }, 60_000)

  beforeEach(async () => {
    sessions.clear()
    await raw.paymentTransaction.deleteMany({ where: { schoolId } })
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    if (!raw) return
    await raw.paymentTransaction.deleteMany({ where: { schoolId } })
    await raw.enrollment.deleteMany({ where: { schoolId } })
    await raw.plan.deleteMany({ where: { schoolId } })
    await raw.student.deleteMany({ where: { schoolId } })
    await raw.familyPerson.deleteMany({ where: { schoolId } })
    await raw.person.deleteMany({ where: { schoolId } })
    await raw.family.deleteMany({ where: { schoolId } })
    await raw.user.deleteMany({ where: { id: adminId } })
    await raw.school.deleteMany({ where: { id: schoolId } })
    await raw.$disconnect()
  }, 60_000)

  it('opens a single payable session for two simultaneous checkouts', async () => {
    const checkout = {
      schoolId,
      familyId,
      initiatedById: adminId,
      customerEmail: 'parent@payment.test',
      locale: 'fr',
      appUrl: 'http://localhost:8550',
    }

    createGate = new Promise((resolve) => {
      releaseCreate = resolve
      setTimeout(resolve, 2_000)
    })
    const results = await Promise.all(
      [0, 1].map((_) =>
        createCheckoutSession(checkout, paymentsEnabled).finally(() => releaseCreate())
      )
    )

    expect(results).toEqual(
      expect.arrayContaining([expect.objectContaining({ result: 'OK' }), 'checkoutInProgress'])
    )
    const open = [...sessions.values()].filter((session) => session.status === 'open')
    expect(open).toHaveLength(1)
    const pending = await raw.paymentTransaction.findMany({
      where: { schoolId, familyId, status: 'PENDING' },
      select: { providerSessionId: true },
    })
    expect(pending).toEqual([{ providerSessionId: open[0]?.id }])
  })
})
