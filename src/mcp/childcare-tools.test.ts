import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'

const { configGateway, childcareGateway, mealAccountGateway } = vi.hoisted(() => ({
  configGateway: { get: vi.fn() },
  childcareGateway: {
    transaction: vi.fn(),
    studentExists: vi.fn(),
    lockStudentSubscription: vi.fn(),
    lockSubscriptionStart: vi.fn(),
    setOpening: vi.fn(),
    listLiveMonths: vi.fn(),
    upsertSubscription: vi.fn(),
    lockBillableSubscriptions: vi.fn(),
    listMonthCharges: vi.fn(),
    createCharges: vi.fn(),
    reviveCharge: vi.fn(),
    lockCharges: vi.fn(),
    cancelCharge: vi.fn(),
    listSubscriptions: vi.fn(),
  },
  mealAccountGateway: { isActiveStudent: vi.fn() },
}))
vi.mock('@/gateways/config-gateway', () => ({ configGateway }))
vi.mock('@/gateways/childcare-gateway', () => ({ childcareGateway }))
vi.mock('@/gateways/meal-account-gateway', () => ({ mealAccountGateway }))
vi.mock('@/lib/school-regional-settings', () => ({ getSchoolRegionalSettings: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: {} }))

const { listChildcareTools } = await import('./childcare-tools')
const scope = {
  schoolId: 'school-a',
  userId: 'admin-a',
  paymentsEnabled: false,
  owner: { kind: 'MCP_KEY' as const, keyId: 'key-a' },
}
const studentId = '00000000-0000-4000-8000-000000000001'
const familyId = '00000000-0000-4000-8000-000000000002'
const chargeId = '00000000-0000-4000-8000-000000000003'
const tx = { transaction: true }
const run = (name: string, args: unknown = {}) => {
  const entry = listChildcareTools(scope).find((tool) => tool.name === name)
  if (!entry) throw new Error(`Missing tool ${name}`)
  return entry.run(args)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-30T08:00:00.000Z'))
  configGateway.get.mockResolvedValue({ value: 'true' })
  vi.mocked(getSchoolRegionalSettings).mockResolvedValue({
    currency: 'KMF',
    timeZone: 'Indian/Comoro',
  } as Awaited<ReturnType<typeof getSchoolRegionalSettings>>)
  childcareGateway.transaction.mockImplementation(async (fn) => fn(tx))
  childcareGateway.studentExists.mockResolvedValue(true)
  childcareGateway.lockStudentSubscription.mockResolvedValue(null)
  childcareGateway.lockSubscriptionStart.mockResolvedValue({ id: 'sub-1', startMonth: '2026-09' })
  childcareGateway.listLiveMonths.mockResolvedValue([])
  childcareGateway.lockBillableSubscriptions.mockResolvedValue([
    { id: 'sub-1', monthlyAmount: 6000, startMonth: '2026-09', endMonth: null },
  ])
  childcareGateway.listMonthCharges.mockResolvedValue([])
  mealAccountGateway.isActiveStudent.mockResolvedValue(true)
})

describe('childcare MCP tools', () => {
  it('reads the child as the childcare screen does, opening and debtor family included', async () => {
    childcareGateway.listSubscriptions.mockResolvedValue([
      {
        id: 'sub-1',
        monthlyAmount: 6000,
        startMonth: '2026-09',
        endMonth: null,
        opening: { paidThrough: '2026-09', reason: 'Liste papier' },
        student: {
          id: studentId,
          isActive: true,
          person: {
            name: 'An_Ichat',
            lastname: 'AHMED DJOUMOI',
            families: [{ familyId, relationType: 'PARENT', family: { name: 'AHMED' } }],
          },
        },
        charges: [
          {
            id: chargeId,
            month: '2026-09',
            amount: 6000,
            paid: 0,
            settled: true,
            cancelled: false,
          },
          {
            id: 'c-2',
            month: '2026-10',
            amount: 6000,
            paid: 2000,
            settled: false,
            cancelled: false,
          },
        ],
      },
    ])

    expect(await run('get_student_childcare', { studentId })).toEqual({
      studentId,
      currentMonth: '2026-10',
      debtorFamilyId: familyId,
      subscription: {
        monthlyAmount: 6000,
        startMonth: '2026-09',
        endMonth: null,
        opening: { paidThrough: '2026-09', reason: 'Liste papier' },
      },
      totals: { billed: 12000, paid: 8000, remaining: 4000 },
      charges: [
        {
          chargeId,
          month: '2026-09',
          amount: 6000,
          paidByReceipts: 0,
          settledByOpening: true,
          remaining: 0,
          cancelled: false,
        },
        {
          chargeId: 'c-2',
          month: '2026-10',
          amount: 6000,
          paidByReceipts: 2000,
          settledByOpening: false,
          remaining: 4000,
          cancelled: false,
        },
      ],
    })
    expect(childcareGateway.listSubscriptions).toHaveBeenCalledWith('school-a', studentId)
  })

  it('answers no subscription for a child without childcare', async () => {
    childcareGateway.listSubscriptions.mockResolvedValue([])

    expect(await run('get_student_childcare', { studentId })).toMatchObject({
      subscription: null,
      charges: [],
      debtorFamilyId: null,
    })
  })

  it('refuses an archived or foreign student on read', async () => {
    mealAccountGateway.isActiveStudent.mockResolvedValue(false)

    expect(await run('get_student_childcare', { studentId })).toBe('notFound')
    expect(childcareGateway.listSubscriptions).not.toHaveBeenCalled()
  })

  it('subscribes in the scoped school, never one passed as argument', async () => {
    expect(
      await run('save_childcare_subscription', {
        studentId,
        monthlyAmount: 6000,
        startMonth: '2026-09',
        endMonth: null,
        schoolId: 'school-b',
      })
    ).toEqual({ success: true })
    expect(childcareGateway.upsertSubscription).toHaveBeenCalledWith(tx, 'school-a', {
      studentId,
      monthlyAmount: 6000,
      startMonth: '2026-09',
      endMonth: null,
    })
  })

  it('refuses to subscribe an archived student', async () => {
    childcareGateway.studentExists.mockResolvedValue(false)

    expect(
      await run('save_childcare_subscription', {
        studentId,
        monthlyAmount: 6000,
        startMonth: '2026-09',
        endMonth: null,
      })
    ).toBe('notFound')
  })

  it('bills a month as the admin of the scope and refuses a future one', async () => {
    expect(await run('bill_childcare_month', { month: '2026-09' })).toEqual({
      billed: 1,
      alreadyBilled: 0,
      outsideRange: 0,
    })
    expect(childcareGateway.createCharges).toHaveBeenCalledWith(
      tx,
      'school-a',
      '2026-09',
      'admin-a',
      [{ subscriptionId: 'sub-1', amount: 6000 }]
    )
    expect(await run('bill_childcare_month', { month: '2026-11' })).toBe('futureMonth')
  })

  it('records an opening as the admin of the scope', async () => {
    expect(
      await run('record_childcare_opening', {
        studentId,
        paidThrough: '2026-10',
        reason: 'Liste papier MS 30/10/2026',
      })
    ).toEqual({ success: true })
    expect(childcareGateway.setOpening).toHaveBeenCalledWith(tx, 'school-a', 'sub-1', {
      paidThrough: '2026-10',
      reason: 'Liste papier MS 30/10/2026',
      recordedById: 'admin-a',
    })
    expect(
      await run('record_childcare_opening', { studentId, paidThrough: '2026-11', reason: 'x' })
    ).toBe('futureMonth')
  })

  it('cancels a billed month without money on it', async () => {
    childcareGateway.lockCharges.mockResolvedValue([{ id: chargeId, cancelled: false, paid: 0 }])

    expect(await run('cancel_childcare_charge', { chargeId, reason: 'Erreur' })).toEqual({
      success: true,
    })
    expect(childcareGateway.cancelCharge).toHaveBeenCalledWith(tx, 'school-a', chargeId, {
      cancelledById: 'admin-a',
      cancelReason: 'Erreur',
    })
  })

  it('stays closed when meals are off', async () => {
    configGateway.get.mockResolvedValue({ value: 'false' })

    expect(await run('get_student_childcare', { studentId })).toBe('mealsDisabled')
    expect(await run('bill_childcare_month', { month: '2026-09' })).toBe('mealsDisabled')
  })
})
