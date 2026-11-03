import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { canonicalReceiptRequest } from '@/domain/receipt'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'

const {
  configGateway,
  mealAccountGateway,
  mealGateway,
  receiptGateway,
  mcpMealReadGateway,
  staffCanteenGateway,
} = vi.hoisted(() => ({
  configGateway: { get: vi.fn() },
  mealAccountGateway: {
    transaction: vi.fn(),
    lockAccount: vi.fn(),
    listSegments: vi.fn(),
    findClosures: vi.fn(),
    replaceOpening: vi.fn(),
    applyStop: vi.fn(),
    isActiveStudent: vi.fn(),
    findStudentAccounts: vi.fn(),
    findStaffAccounts: vi.fn(),
    listLedgers: vi.fn(),
    listPrices: vi.fn(),
    listAbsences: vi.fn(),
  },
  mealGateway: { upsertSetting: vi.fn() },
  receiptGateway: { findByIdempotencyKey: vi.fn(), transaction: vi.fn() },
  mcpMealReadGateway: {
    settings: vi.fn(),
    prices: vi.fn(),
    familyExists: vi.fn(),
    receipts: vi.fn(),
  },
  staffCanteenGateway: { find: vi.fn(), list: vi.fn() },
}))
vi.mock('@/gateways/config-gateway', () => ({ configGateway }))
vi.mock('@/gateways/meal-account-gateway', () => ({ mealAccountGateway }))
vi.mock('@/gateways/meal-gateway', () => ({ mealGateway }))
vi.mock('@/gateways/receipt-gateway', () => ({ receiptGateway }))
vi.mock('@/gateways/mcp-meal-read-gateway', () => ({ mcpMealReadGateway }))
vi.mock('@/gateways/staff-canteen-gateway', () => ({ staffCanteenGateway }))
vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: vi
    .fn()
    .mockResolvedValue({ currency: 'KMF', timeZone: 'Indian/Comoro' }),
}))
vi.mock('@/lib/db', () => ({ db: {} }))

const { listMealTools } = await import('./meal-tools')
const scope = {
  schoolId: 'school-a',
  userId: 'admin-a',
  paymentsEnabled: false,
  owner: { kind: 'MCP_KEY' as const, keyId: 'key-a' },
}
const studentId = '00000000-0000-4000-8000-000000000001'
const familyId = '00000000-0000-4000-8000-000000000002'
const tx = { transaction: true }
const run = (name: string, args: unknown = {}) => {
  const entry = listMealTools(scope).find((tool) => tool.name === name)
  if (!entry) throw new Error(`Missing tool ${name}`)
  return entry.run(args)
}

beforeEach(() => {
  vi.resetAllMocks()
  configGateway.get.mockImplementation(async (_school, key) => ({
    value: key === 'payments_enabled' ? 'false' : 'true',
  }))
  vi.mocked(getSchoolRegionalSettings).mockResolvedValue({
    currency: 'KMF',
    timeZone: 'Indian/Comoro',
  } as Awaited<ReturnType<typeof getSchoolRegionalSettings>>)
  mealAccountGateway.transaction.mockImplementation(async (fn) => fn(tx))
  mealAccountGateway.lockAccount.mockResolvedValue('account-a')
  mealAccountGateway.listSegments.mockResolvedValue([
    {
      id: 'segment-a',
      accountId: 'account-a',
      periodId: 'period-a',
      weekdays: [1, 2, 3, 4],
      startOn: '2026-10-26',
      endOn: null,
      periodEnd: '2026-12-31',
    },
  ])
  mealAccountGateway.findClosures.mockResolvedValue([])
})

describe('meal tools shared by MCP and assistant', () => {
  it('takes opening identity only from scope and returns success for domain OK', async () => {
    expect(
      await run('record_meal_opening', {
        studentId,
        service: 'CANTEEN',
        paidThrough: '2026-10-29',
        reason: 'Historical ledger',
        schoolId: 'forged-school',
        recordedById: 'forged-user',
      })
    ).toEqual({ success: true })
    expect(mealAccountGateway.replaceOpening).toHaveBeenCalledWith(tx, 'school-a', {
      accountId: 'account-a',
      days: 4,
      reason: 'Historical ledger',
      recordedById: 'admin-a',
    })
    expect(configGateway.get).toHaveBeenCalledWith('school-a', 'meals_enabled')
  })

  it('keeps disabled meals private and does no meal reads or writes', async () => {
    configGateway.get.mockResolvedValue(null)
    expect(await run('get_meal_settings')).toBe('mealsDisabled')
    expect(await run('get_student_meals', { studentId })).toBe('mealsDisabled')
    expect(await run('list_family_receipts', { familyId })).toBe('mealsDisabled')
    expect(
      await run('record_meal_opening', {
        studentId,
        service: 'CANTEEN',
        paidThrough: '2026-10-29',
        reason: 'Ledger',
      })
    ).toBe('mealsDisabled')
    expect(mcpMealReadGateway.settings).not.toHaveBeenCalled()
    expect(mealAccountGateway.transaction).not.toHaveBeenCalled()
  })

  it('reuses weekday validation and school-scoped service configuration', async () => {
    expect(
      await run('set_meal_service_setting', {
        service: 'SNACK',
        isEnabled: true,
        allowedWeekdays: [4, 1],
        schoolId: 'forged-school',
      })
    ).toEqual({ success: true })
    expect(mealGateway.upsertSetting).toHaveBeenCalledWith('school-a', 'SNACK', {
      isEnabled: true,
      allowedWeekdays: [1, 4],
    })
    expect(
      await run('set_meal_service_setting', {
        service: 'SNACK',
        isEnabled: true,
        allowedWeekdays: [1, 1],
      })
    ).toBe('invalidWeekdays')
    expect(mealGateway.upsertSetting).toHaveBeenCalledTimes(1)
  })

  it('preserves receipt idempotency and detects a changed request without writing', async () => {
    const args = {
      familyId,
      idempotencyKey: '00000000-0000-4000-8000-000000000003',
      method: 'CASH' as const,
      tuition: 0,
      meals: [{ studentId, service: 'CANTEEN' as const, amount: 12000, expectedPaidThrough: null }],
    }
    const requestHash = createHash('sha256')
      .update(
        canonicalReceiptRequest({
          ...args,
          reference: null,
        })
      )
      .digest('hex')
    receiptGateway.findByIdempotencyKey.mockResolvedValue({ id: 'receipt-a', requestHash })
    expect(
      await run('record_receipt', {
        ...args,
        schoolId: 'forged-school',
        recordedById: 'forged-user',
      })
    ).toEqual({ id: 'receipt-a' })
    expect(await run('record_receipt', args)).toEqual({ id: 'receipt-a' })
    expect(
      await run('record_receipt', { ...args, meals: [{ ...args.meals[0], amount: 15000 }] })
    ).toBe('idempotencyConflict')
    expect(receiptGateway.findByIdempotencyKey).toHaveBeenCalledWith(
      'school-a',
      args.idempotencyKey
    )
    expect(receiptGateway.transaction).not.toHaveBeenCalled()
  })

  it('preserves receipt feature and line validation even without tuition tools', async () => {
    const args = {
      familyId,
      idempotencyKey: '00000000-0000-4000-8000-000000000003',
      method: 'CASH',
      tuition: 0,
      meals: [],
    }
    expect(await run('record_receipt', args)).toBe('validationError')
    expect(await run('record_receipt', { ...args, tuition: 10 })).toBe('paymentsDisabled')
    expect(receiptGateway.findByIdempotencyKey).not.toHaveBeenCalled()
  })

  it('reads only the scoped student and bounds the returned calendar', async () => {
    mealAccountGateway.isActiveStudent.mockResolvedValue(true)
    mealAccountGateway.findStudentAccounts.mockResolvedValue([
      {
        id: 'account-a',
        studentId,
        service: 'CANTEEN',
        schedules: [],
      },
    ])
    mealAccountGateway.listLedgers.mockResolvedValue({
      adjustments: [
        { accountId: 'account-a', kind: 'OPENING', days: 4, reason: 'Historical ledger' },
      ],
      payments: [],
    })
    mealAccountGateway.listPrices.mockResolvedValue([
      { service: 'CANTEEN', amount: 750, effectiveFrom: '2026-10-01' },
    ])
    mealAccountGateway.listAbsences.mockResolvedValue([])
    const result = await run('get_student_meals', {
      studentId,
      from: '2026-10-26',
      to: '2026-10-29',
      schoolId: 'forged-school',
    })
    expect(result).toMatchObject({
      studentId,
      accounts: [
        {
          service: 'CANTEEN',
          opening: { days: 4, reason: 'Historical ledger' },
          coverage: { paidThrough: '2026-10-29' },
          calendar: [
            { day: '2026-10-26', status: 'paid' },
            { day: '2026-10-27', status: 'paid' },
            { day: '2026-10-28', status: 'paid' },
            { day: '2026-10-29', status: 'paid' },
          ],
        },
      ],
    })
    expect(mealAccountGateway.isActiveStudent).toHaveBeenCalledWith('school-a', studentId)
    expect(mealAccountGateway.findStudentAccounts).toHaveBeenCalledWith('school-a', [studentId])
    expect(
      await run('get_student_meals', { studentId, from: '2026-01-01', to: '2027-01-01' })
    ).toBe('rangeTooLong')
    expect(
      await run('get_student_meals', { studentId, from: '2026-11-01', to: '2026-10-01' })
    ).toBe('invalidDateRange')
  })

  it('refuses foreign students and families before publishing records', async () => {
    mealAccountGateway.isActiveStudent.mockResolvedValue(false)
    mcpMealReadGateway.familyExists.mockResolvedValue(false)
    expect(await run('get_student_meals', { studentId })).toBe('notFound')
    expect(await run('list_family_receipts', { familyId })).toBe('notFound')
    expect(mcpMealReadGateway.familyExists).toHaveBeenCalledWith('school-a', familyId)
    expect(mealAccountGateway.findStudentAccounts).not.toHaveBeenCalled()
    expect(mcpMealReadGateway.receipts).not.toHaveBeenCalled()
  })

  it('reads settings and prices without actor fields and truncates family receipts explicitly', async () => {
    mcpMealReadGateway.settings.mockResolvedValue([
      { service: 'CANTEEN', isEnabled: true, allowedWeekdays: [1, 2, 3, 4] },
    ])
    mcpMealReadGateway.prices.mockResolvedValue([
      { id: 'price-a', service: 'CANTEEN', amount: '750', effectiveFrom: new Date('2026-10-01') },
    ])
    expect(await run('get_meal_settings')).toMatchObject({
      prices: [{ amount: 750, effectiveFrom: '2026-10-01' }],
    })
    expect(mcpMealReadGateway.prices).toHaveBeenCalledWith('school-a')
    mcpMealReadGateway.familyExists.mockResolvedValue(true)
    mcpMealReadGateway.receipts.mockResolvedValue([{ id: 'receipt-a' }, { id: 'receipt-b' }])
    expect(await run('list_family_receipts', { familyId, limit: 1 })).toEqual({
      receipts: [{ id: 'receipt-a' }],
      hasMore: true,
    })
    expect(mcpMealReadGateway.receipts).toHaveBeenCalledWith('school-a', familyId, 2)
  })

  it('publishes safe schemas and requires human approval for each assistant mutation', () => {
    for (const tool of listMealTools(scope)) {
      const json = z.toJSONSchema(tool.inputSchema, { target: 'draft-2020-12', io: 'input' })
      expect(json.type).toBe('object')
      expect(Object.keys(tool.inputSchema.shape)).not.toEqual(expect.arrayContaining(['schoolId']))
      expect(Object.keys(tool.inputSchema.shape)).not.toEqual(
        expect.arrayContaining(['recordedById'])
      )
      expect(Object.keys(tool.inputSchema.shape)).not.toContain('cancelledById')
      expect(Object.keys(tool.inputSchema.shape)).not.toContain('paidAt')
      expect(tool.kind).toBe(tool.annotations?.readOnlyHint ? 'read' : 'write')
    }
    expect(
      listMealTools(scope).find((tool) => tool.name === 'record_receipt')?.annotations
    ).toMatchObject({ idempotentHint: true })
    expect(
      listMealTools(scope).find((tool) => tool.name === 'record_meal_opening')?.annotations
    ).toMatchObject({ destructiveHint: true })
  })
})

describe('staff meal tools', () => {
  const teacherId = '00000000-0000-4000-8000-000000000010'
  const otherId = '00000000-0000-4000-8000-000000000011'
  const segment = {
    id: 'segment-a',
    accountId: 'account-a',
    periodId: 'period-a',
    weekdays: [1, 2, 3, 4],
    startOn: '2026-10-26',
    endOn: null,
    periodEnd: '2026-12-31',
  }
  const member = (id: string, extra: object = {}) => ({
    id,
    name: `Staff ${id.slice(-2)}`,
    mealExempt: false,
    isActive: true,
    ...extra,
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-30T08:00:00.000Z'))
    mealAccountGateway.listLedgers.mockResolvedValue({ adjustments: [], payments: [] })
    mealAccountGateway.listPrices.mockResolvedValue([
      { service: 'CANTEEN', amount: 750, effectiveFrom: '2026-10-01' },
    ])
    mealAccountGateway.listAbsences.mockResolvedValue([])
    mealAccountGateway.findStaffAccounts.mockResolvedValue([
      { id: 'account-a', teacherId, service: 'CANTEEN', schedules: [segment] },
    ])
  })
  afterEach(() => vi.useRealTimers())

  it('shows a subscribed staff member with weekdays, start date and dues', async () => {
    staffCanteenGateway.find.mockResolvedValue(member(teacherId))
    expect(
      await run('get_staff_meals', { teacherId, from: '2026-10-26', to: '2026-10-29' })
    ).toMatchObject({
      teacherId,
      mealExempt: false,
      accounts: [
        {
          service: 'CANTEEN',
          current: { weekdays: [1, 2, 3, 4], startOn: '2026-10-26', endOn: null },
          coverage: { paidThrough: null, dueDays: 4, dueAmount: 3000 },
          calendar: [
            { day: '2026-10-26', status: 'due' },
            { day: '2026-10-27', status: 'due' },
            { day: '2026-10-28', status: 'due' },
            { day: '2026-10-29', status: 'due' },
          ],
        },
      ],
    })
    expect(staffCanteenGateway.find).toHaveBeenCalledWith('school-a', teacherId)
    expect(mealAccountGateway.findStaffAccounts).toHaveBeenCalledWith('school-a', [teacherId])
  })

  it('owes nothing for an exempt member', async () => {
    staffCanteenGateway.find.mockResolvedValue(member(teacherId, { mealExempt: true }))
    expect(await run('get_staff_meals', { teacherId })).toMatchObject({
      mealExempt: true,
      accounts: [{ coverage: { dueDays: 0, dueAmount: 0 } }],
    })
  })

  it('refuses a teacher of another school or deactivated', async () => {
    staffCanteenGateway.find.mockResolvedValue(null)
    expect(await run('get_staff_meals', { teacherId })).toBe('notFound')
    staffCanteenGateway.find.mockResolvedValue(member(teacherId, { isActive: false }))
    expect(await run('get_staff_meals', { teacherId })).toBe('notFound')
    expect(mealAccountGateway.findStaffAccounts).not.toHaveBeenCalled()
    configGateway.get.mockResolvedValue(null)
    expect(await run('get_staff_meals', { teacherId })).toBe('mealsDisabled')
    expect(await run('list_staff_meal_subscriptions')).toBe('mealsDisabled')
  })

  it('lists every active staff member of the school in one call', async () => {
    staffCanteenGateway.list.mockResolvedValue([
      member(teacherId),
      member(otherId, { mealExempt: true }),
      member('00000000-0000-4000-8000-000000000012', { isActive: false }),
    ])
    mealAccountGateway.findStaffAccounts.mockResolvedValue([
      { id: 'account-a', teacherId, service: 'CANTEEN', schedules: [segment] },
      {
        id: 'account-b',
        teacherId: otherId,
        service: 'CANTEEN',
        schedules: [{ ...segment, id: 'segment-b', accountId: 'account-b' }],
      },
      { id: 'account-c', teacherId, service: 'SNACK', schedules: [] },
    ])
    const result = await run('list_staff_meal_subscriptions', {
      service: 'CANTEEN',
      date: '2026-11-02',
    })
    expect(result).toMatchObject({
      today: '2026-10-30',
      date: '2026-11-02',
      staff: [
        {
          teacherId,
          accounts: [
            {
              id: 'account-a',
              service: 'CANTEEN',
              segment: { weekdays: [1, 2, 3, 4], startOn: '2026-10-26' },
              paidThrough: null,
              dueDays: 4,
              dueAmount: 3000,
            },
          ],
        },
        { teacherId: otherId, mealExempt: true, accounts: [{ dueDays: 0, dueAmount: 0 }] },
      ],
    })
    const { staff } = result as { staff: Array<{ accounts: unknown[] }> }
    expect(staff).toHaveLength(2)
    expect(staff[0].accounts).toHaveLength(1)
    expect(staffCanteenGateway.list).toHaveBeenCalledWith('school-a')
    expect(mealAccountGateway.findStaffAccounts).toHaveBeenCalledWith('school-a', [
      teacherId,
      otherId,
    ])
  })

  it('stops and opens a staff account through the shared use cases', async () => {
    expect(
      await run('stop_meal', { teacherId, service: 'CANTEEN', effectiveFrom: '2026-11-02' })
    ).toEqual({ success: true })
    expect(mealAccountGateway.lockAccount).toHaveBeenCalledWith(
      tx,
      'school-a',
      { teacherId },
      'CANTEEN',
      false
    )
    expect(
      await run('record_meal_opening', {
        teacherId,
        service: 'CANTEEN',
        paidThrough: '2026-10-29',
        reason: 'Cahier',
      })
    ).toEqual({ success: true })
    expect(mealAccountGateway.replaceOpening).toHaveBeenCalledWith(tx, 'school-a', {
      accountId: 'account-a',
      days: 4,
      reason: 'Cahier',
      recordedById: 'admin-a',
    })
  })

  it('requires exactly one owner on the account tools', async () => {
    const base = { service: 'CANTEEN', effectiveFrom: '2026-11-02' }
    expect(await run('stop_meal', base)).toBe('validationError')
    expect(await run('stop_meal', { ...base, studentId, teacherId })).toBe('validationError')
    expect(
      await run('change_meal_schedule', { ...base, weekdays: [1], studentId, teacherId })
    ).toBe('validationError')
    expect(
      await run('toggle_meal_absence', { service: 'CANTEEN', day: '2026-10-27', absent: true })
    ).toBe('validationError')
    expect(mealAccountGateway.transaction).not.toHaveBeenCalled()
  })
})
