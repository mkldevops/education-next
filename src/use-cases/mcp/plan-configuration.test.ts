import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlanFromMcp, updatePlanFromMcp } from './plan-configuration'

const scope = { schoolId: 'school-1', paymentsEnabled: true }
const id = '00000000-0000-4000-8000-000000000001'
const pricing = { mode: 'MONTHLY' as const, amount: 100, months: 10 }
const paymentSchedule = { mode: 'MONTHLY' as const, firstMonth: 9, count: 10, dueDay: 5 }
const result = { id, name: 'Temps plein', amount: 1000, pricing, paymentSchedule }
const create = vi.fn()
const update = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  create.mockResolvedValue(result)
  update.mockResolvedValue(result)
})

describe('MCP plan configuration', () => {
  it('creates from monthly pricing and a schedule using only the authenticated school', async () => {
    const input = { name: 'Temps plein', pricing, paymentSchedule, schoolId: 'other-school' }

    expect(await createPlanFromMcp(scope, input, create)).toEqual({
      ...result,
      amount: '1000',
    })
    expect(create).toHaveBeenCalledWith({
      name: 'Temps plein',
      pricing,
      paymentSchedule,
      schoolId: 'school-1',
    })
  })

  it('updates the chosen formula using the common plan use case', async () => {
    const input = { id, paymentSchedule: { mode: 'NONE' as const }, schoolId: 'other-school' }

    await updatePlanFromMcp(scope, input, update)

    expect(update).toHaveBeenCalledWith({
      id,
      schoolId: 'school-1',
      paymentSchedule: { mode: 'NONE' },
    })
  })

  it.each(['create', 'update'])(
    'refuses %s without writing when payments are disabled',
    async (operation) => {
      const disabled = { ...scope, paymentsEnabled: false }
      const returned =
        operation === 'create'
          ? await createPlanFromMcp(disabled, { name: 'Temps plein', pricing }, create)
          : await updatePlanFromMcp(disabled, { id, pricing }, update)

      expect(returned).toBe('paymentsDisabled')
      expect(create).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
    }
  )

  it.each([
    { mode: 'MONTHLY', firstMonth: 9, count: 13, dueDay: 5 },
    { mode: 'QUARTERLY', firstMonth: 9, count: 5, dueDay: 5 },
    { mode: 'MONTHLY', firstMonth: 0, count: 10, dueDay: 5 },
    { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 32 },
    {
      mode: 'INSTALLMENTS',
      dates: Array.from({ length: 6 }, (_, index) => ({ month: index + 1, day: 5 })),
    },
  ])('rejects an invalid schedule before invoking any writer', async (invalidSchedule) => {
    const input = { name: 'Temps plein', pricing, paymentSchedule: invalidSchedule }

    expect(await createPlanFromMcp(scope, input as never, create)).toBe('validationError')
    expect(create).not.toHaveBeenCalled()
  })

  it('forwards typed refusals from the shared plan operation', async () => {
    create.mockResolvedValue('unpricedPlan')
    update.mockResolvedValue('notFound')

    expect(await createPlanFromMcp(scope, { name: '__unpriced__', amount: 100 }, create)).toBe(
      'unpricedPlan'
    )
    expect(await updatePlanFromMcp(scope, { id, pricing }, update)).toBe('notFound')
  })

  it('publishes only whitelisted configuration fields after a write', async () => {
    create.mockResolvedValue({ ...result, schoolId: 'school-1', secret: 'private' })

    const published = await createPlanFromMcp(scope, { name: 'Temps plein', pricing }, create)

    expect(published).not.toHaveProperty('schoolId')
    expect(published).not.toHaveProperty('secret')
  })
})
