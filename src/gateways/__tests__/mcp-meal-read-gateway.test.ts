import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  mealServiceSetting: { findMany: vi.fn() },
  mealPrice: { findMany: vi.fn() },
  family: { count: vi.fn() },
  receipt: { findMany: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ db }))
const { mcpMealReadGateway } = await import('../mcp-meal-read-gateway')

beforeEach(() => vi.clearAllMocks())

describe('MCP meal read projections', () => {
  it('scopes configuration reads and publishes only configuration fields', async () => {
    await mcpMealReadGateway.settings('school-a')
    await mcpMealReadGateway.prices('school-a')
    expect(db.mealServiceSetting.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-a' },
      select: { service: true, isEnabled: true, allowedWeekdays: true },
      orderBy: { service: 'asc' },
    })
    expect(db.mealPrice.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-a' },
      select: { id: true, service: true, amount: true, effectiveFrom: true },
      orderBy: [{ service: 'asc' }, { effectiveFrom: 'asc' }],
    })
  })

  it('checks family ownership before a caller can read its receipts', async () => {
    db.family.count.mockResolvedValue(0)
    expect(await mcpMealReadGateway.familyExists('school-a', 'foreign-family')).toBe(false)
    expect(db.family.count).toHaveBeenCalledWith({
      where: { schoolId: 'school-a', id: 'foreign-family' },
    })
  })

  it('bounds receipts with a deterministic order and excludes actor and request credentials', async () => {
    await mcpMealReadGateway.receipts('school-a', 'family-a', 51)
    const [query] = db.receipt.findMany.mock.calls[0]
    expect(query.where).toEqual({ schoolId: 'school-a', familyId: 'family-a' })
    expect(query.take).toBe(51)
    expect(query.orderBy).toEqual([{ paidAt: 'desc' }, { id: 'desc' }])
    expect(Object.keys(query.select).sort()).toEqual([
      'cancelReason',
      'cancelledAt',
      'childcarePayments',
      'id',
      'mealPayments',
      'method',
      'number',
      'paidAt',
      'reference',
      'total',
    ])
    expect(query.select.mealPayments.select.account).toEqual({
      select: { studentId: true, service: true },
    })
    expect(query.select.childcarePayments.select).toEqual({ chargeId: true, amount: true })
    expect(query.select).not.toHaveProperty('requestHash')
    expect(query.select).not.toHaveProperty('idempotencyKey')
    expect(query.select).not.toHaveProperty('recordedById')
    expect(query.select).not.toHaveProperty('cancelledById')
  })
})
