import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createForFamily = vi.fn()
const lockFamilyForPayment = vi.fn()
const readLockedFamilyBalances = vi.fn()

vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: {
    createForFamily: (...args: unknown[]) => createForFamily(...args),
    lockFamilyForPayment: (...args: unknown[]) => lockFamilyForPayment(...args),
  },
}))
vi.mock('@/use-cases/payments/locked-family-balance', () => ({
  readLockedFamilyBalances: (...args: unknown[]) => readLockedFamilyBalances(...args),
}))
vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: async () => ({ currency: 'EUR', timeZone: 'UTC' }),
}))

const { recordReceipt } = await import('./record-receipt')

type ReceiptGw = Parameters<typeof recordReceipt>[1]
type AccountGw = Parameters<typeof recordReceipt>[2]
type ConfigGw = Parameters<typeof recordReceipt>[3]

const schoolId = 'school-a'
const familyId = '0b6e3c1a-2d4f-4a5b-9c8d-7e6f5a4b3c2d'
const studentId = '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f'
const idempotencyKey = '5d1c9a2e-8b7f-4e3d-a6c5-b4a39281706f'
const tx = { tx: true }

// Lundi, mardi, jeudi, vendredi depuis le lundi 7 septembre.
const segment = {
  id: 's',
  accountId: 'account-1',
  periodId: 'p',
  weekdays: [1, 2, 4, 5],
  startOn: '2026-09-07',
  endOn: null,
  periodEnd: '2027-07-03',
}

function setup(flags: Record<string, string> = {}) {
  const receiptGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    findStudentFamilies: vi
      .fn()
      .mockResolvedValue([
        { id: studentId, person: { families: [{ familyId, relationType: 'PARENT' }] } },
      ]),
    nextNumber: vi.fn().mockResolvedValue(7),
    create: vi.fn().mockResolvedValue({ id: 'receipt-1' }),
    createMealPayments: vi.fn(),
  }
  const accountGw = {
    lockAccounts: vi.fn().mockResolvedValue([{ id: 'account-1', studentId, service: 'CANTEEN' }]),
    listSegments: vi.fn().mockResolvedValue([segment]),
    listLedgers: vi.fn().mockResolvedValue({ adjustments: [], payments: [] }),
    listAbsences: vi.fn().mockResolvedValue([]),
    listPrices: vi
      .fn()
      .mockResolvedValue([{ service: 'CANTEEN', amount: 500, effectiveFrom: '2026-09-01' }]),
    findClosures: vi.fn().mockResolvedValue([]),
  }
  const configGw = {
    get: vi.fn(async (_school: string, key: string) => ({ value: flags[key] ?? 'true' })),
  }
  const run = (input: Partial<Parameters<typeof recordReceipt>[0]> = {}) =>
    recordReceipt(
      {
        schoolId,
        recordedById: 'admin-1',
        idempotencyKey,
        familyId,
        method: 'CASH',
        tuition: 0,
        meals: [{ studentId, service: 'CANTEEN', amount: 1000, expectedPaidThrough: null }],
        ...input,
      },
      receiptGw as unknown as ReceiptGw,
      accountGw as unknown as AccountGw,
      configGw as unknown as ConfigGw
    )
  return { receiptGw, accountGw, run }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-14T08:00:00.000Z'))
  lockFamilyForPayment.mockResolvedValue(true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('recordReceipt', () => {
  it('buys served days at the price of the day and numbers the receipt', async () => {
    const { receiptGw, run } = setup()

    expect(await run()).toEqual({ id: 'receipt-1' })
    expect(receiptGw.create).toHaveBeenCalledWith(
      tx,
      schoolId,
      expect.objectContaining({ familyId, number: 7, total: 1000, method: 'CASH' })
    )
    expect(receiptGw.createMealPayments).toHaveBeenCalledWith(tx, schoolId, 'receipt-1', [
      {
        accountId: 'account-1',
        amount: 1000,
        unitPrice: 500,
        daysAdded: 2,
        paidThroughAtReceipt: '2026-09-08',
        creditAtReceipt: 0,
      },
    ])
    expect(createForFamily).toHaveBeenCalledWith(tx, schoolId, [])
  })

  it('returns the receipt already issued for the same request', async () => {
    const first = setup()
    await first.run()
    const requestHash = first.receiptGw.create.mock.calls[0][2].requestHash

    const { receiptGw, run } = setup()
    receiptGw.findByIdempotencyKey.mockResolvedValue({ id: 'receipt-0', requestHash })

    expect(await run()).toEqual({ id: 'receipt-0' })
    expect(receiptGw.transaction).not.toHaveBeenCalled()
  })

  it('refuses the same key with another content', async () => {
    const { receiptGw, run } = setup()
    receiptGw.findByIdempotencyKey.mockResolvedValue({ id: 'receipt-0', requestHash: 'other' })

    expect(await run()).toBe('idempotencyConflict')
    expect(receiptGw.transaction).not.toHaveBeenCalled()
  })

  it('resolves a concurrent insert of the same key by replaying it', async () => {
    const { receiptGw, run } = setup()
    receiptGw.transaction.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    receiptGw.findByIdempotencyKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'receipt-0', requestHash: 'other' })

    expect(await run()).toBe('idempotencyConflict')
  })

  it('refuses when another payment moved "paid through" since the preview', async () => {
    const { receiptGw, accountGw, run } = setup()
    accountGw.listLedgers.mockResolvedValue({
      adjustments: [{ accountId: 'account-1', kind: 'OPENING', days: 1, reason: 'Cahier' }],
      payments: [],
    })

    expect(await run()).toBe('staleState')
    expect(receiptGw.create).not.toHaveBeenCalled()
  })

  it('refuses a service without a price on the day', async () => {
    const { accountGw, run } = setup()
    accountGw.listPrices.mockResolvedValue([])

    expect(await run()).toBe('noPrice')
  })

  it('refuses a student without the service', async () => {
    const { accountGw, run } = setup()
    accountGw.lockAccounts.mockResolvedValue([])

    expect(await run()).toBe('notSubscribed')
  })

  it('refuses a student whose debt belongs to another family', async () => {
    const { receiptGw, run } = setup()
    receiptGw.findStudentFamilies.mockResolvedValue([
      { id: studentId, person: { families: [{ familyId: 'other', relationType: 'PARENT' }] } },
    ])

    expect(await run()).toBe('notInFamily')
  })

  it('refuses an archived or unknown family', async () => {
    const { run } = setup()
    lockFamilyForPayment.mockResolvedValue(false)

    expect(await run()).toBe('notFound')
  })

  it('spreads tuition over the family enrollments, tied to the receipt', async () => {
    const { receiptGw, run } = setup()
    readLockedFamilyBalances.mockResolvedValue([
      { enrollmentId: 'enrollment-1', remainingBalance: 300, totalAmount: 300, discount: 0 },
    ])

    expect(await run({ tuition: 200, meals: [] })).toEqual({ id: 'receipt-1' })
    expect(receiptGw.create).toHaveBeenCalledWith(
      tx,
      schoolId,
      expect.objectContaining({ total: 200 })
    )
    expect(createForFamily).toHaveBeenCalledWith(tx, schoolId, [
      expect.objectContaining({
        familyId,
        enrollmentId: 'enrollment-1',
        amount: 200,
        method: 'CASH',
        receiptId: 'receipt-1',
      }),
    ])
  })

  it('refuses tuition above what the family owes', async () => {
    const { receiptGw, run } = setup()
    readLockedFamilyBalances.mockResolvedValue([
      { enrollmentId: 'enrollment-1', remainingBalance: 100, totalAmount: 100, discount: 0 },
    ])

    expect(await run({ tuition: 200, meals: [] })).toBe('overpayment')
    expect(receiptGw.create).not.toHaveBeenCalled()
  })

  it('refuses tuition when online and manual payments are off', async () => {
    const { run } = setup({ payments_enabled: 'false' })

    expect(await run({ tuition: 200 })).toBe('paymentsDisabled')
  })

  it('refuses an empty receipt', async () => {
    const { run } = setup()

    expect(await run({ meals: [] })).toBe('validationError')
  })
})
