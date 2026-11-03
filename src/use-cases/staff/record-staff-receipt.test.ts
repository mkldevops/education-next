import { describe, expect, it, vi } from 'vitest'

const loadMealAccountSummaries = vi.fn()

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: async () => ({ currency: 'EUR', timeZone: 'UTC' }),
}))
vi.mock('@/use-cases/meals/meal-account-summaries', () => ({
  loadMealAccountSummaries: (...args: unknown[]) => loadMealAccountSummaries(...args),
}))
vi.mock('@/domain/meal-ledger', () => ({
  previewMealPayment: () => ({ daysAdded: 4, newPaidThrough: '2026-11-12', remainder: 0 }),
}))

const { recordStaffReceipt } = await import('./record-staff-receipt')

type ReceiptGw = Parameters<typeof recordStaffReceipt>[1]
type AccountGw = Parameters<typeof recordStaffReceipt>[2]
type StaffGw = Parameters<typeof recordStaffReceipt>[3]
type ConfigGw = Parameters<typeof recordStaffReceipt>[4]

const schoolId = 'school-a'
const staffMemberId = '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f'
const idempotencyKey = '5d1c9a2e-8b7f-4e3d-a6c5-b4a39281706f'

function setup(
  options: {
    staff?: { isActive: boolean; mealExempt: boolean } | null
    accountId?: string | null
    paidThrough?: string | null
    existing?: { id: string; requestHash: string } | null
  } = {}
) {
  const receiptGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn({ tx: true })),
    findByIdempotencyKey: vi.fn().mockResolvedValue(options.existing ?? null),
    nextNumber: vi.fn().mockResolvedValue(7),
    create: vi.fn().mockResolvedValue({ id: 'receipt-1' }),
    createMealPayments: vi.fn(),
  }
  const accountGw = {
    lockAccount: vi
      .fn()
      .mockResolvedValue(options.accountId === undefined ? 'account-1' : options.accountId),
  }
  const staffGw = {
    findForReceipt: vi
      .fn()
      .mockResolvedValue(
        options.staff === undefined ? { isActive: true, mealExempt: false } : options.staff
      ),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: 'true' }) }
  loadMealAccountSummaries.mockResolvedValue(
    new Map([
      [
        'account-1',
        {
          served: ['2026-11-02'],
          ledger: [],
          unitPrice: 5,
          coverage: { paidThrough: options.paidThrough ?? null },
          current: { weekdays: [1, 2, 3, 4] },
        },
      ],
    ])
  )
  const run = (input: Partial<Parameters<typeof recordStaffReceipt>[0]> = {}) =>
    recordStaffReceipt(
      {
        schoolId,
        recordedById: 'cashier-1',
        idempotencyKey,
        staffMemberId,
        service: 'CANTEEN',
        amount: 20,
        expectedPaidThrough: null,
        method: 'CASH',
        ...input,
      },
      receiptGw as unknown as ReceiptGw,
      accountGw as unknown as AccountGw,
      staffGw as unknown as StaffGw,
      configGw as unknown as ConfigGw
    )
  return { receiptGw, accountGw, run }
}

describe('recordStaffReceipt', () => {
  it('records a family-less receipt with one meal line', async () => {
    const { receiptGw, accountGw, run } = setup()

    expect(await run()).toEqual({ id: 'receipt-1' })
    expect(accountGw.lockAccount).toHaveBeenCalledWith(
      { tx: true },
      schoolId,
      { staffMemberId },
      'CANTEEN',
      false
    )
    expect(receiptGw.create).toHaveBeenCalledWith(
      { tx: true },
      schoolId,
      expect.objectContaining({ staffMemberId, number: 7, total: 20 })
    )
    expect(receiptGw.create.mock.calls[0][2]).not.toHaveProperty('familyId')
    expect(receiptGw.createMealPayments).toHaveBeenCalledWith({ tx: true }, schoolId, 'receipt-1', [
      expect.objectContaining({ accountId: 'account-1', amount: 20, unitPrice: 5, daysAdded: 4 }),
    ])
  })

  it('never bills an exempt member', async () => {
    const { receiptGw, run } = setup({ staff: { isActive: true, mealExempt: true } })

    expect(await run()).toBe('exempt')
    expect(receiptGw.create).not.toHaveBeenCalled()
  })

  it('refuses an inactive or unknown member', async () => {
    expect(await setup({ staff: { isActive: false, mealExempt: false } }).run()).toBe('notFound')
    expect(await setup({ staff: null }).run()).toBe('notFound')
  })

  it('refuses a member without a canteen account', async () => {
    expect(await setup({ accountId: null }).run()).toBe('notSubscribed')
  })

  it('refuses a stale coverage', async () => {
    const { receiptGw, run } = setup({ paidThrough: '2026-11-05' })

    expect(await run()).toBe('staleState')
    expect(receiptGw.create).not.toHaveBeenCalled()
  })

  it('replays a receipt already recorded with the same key', async () => {
    const first = setup()
    await first.run()
    const requestHash = first.receiptGw.create.mock.calls[0][2].requestHash

    const replayed = setup({ existing: { id: 'receipt-0', requestHash } })
    expect(await replayed.run()).toEqual({ id: 'receipt-0' })
    expect(replayed.receiptGw.transaction).not.toHaveBeenCalled()

    const conflicting = setup({ existing: { id: 'receipt-0', requestHash: 'other' } })
    expect(await conflicting.run()).toBe('idempotencyConflict')
  })
})
