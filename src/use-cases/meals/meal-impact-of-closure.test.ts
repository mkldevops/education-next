import { describe, expect, it, vi } from 'vitest'
import { mealImpactOfClosure } from './meal-impact-of-closure'

type AccountGw = Parameters<typeof mealImpactOfClosure>[1]
type ConfigGw = Parameters<typeof mealImpactOfClosure>[2]

const schoolId = 'school-a'
const tx = { tx: true }

// Lundi et jeudi : les dix premiers jours servis vont du 7 septembre au 8 octobre.
const segment = (accountId: string) => ({
  id: `s-${accountId}`,
  accountId,
  periodId: 'p',
  weekdays: [1, 4],
  startOn: '2026-09-07',
  endOn: null,
  periodEnd: '2027-07-03',
})

function setup({ closures = [] as unknown[], enabled = true } = {}) {
  const accountGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    findActiveStudentAccounts: vi.fn().mockResolvedValue([
      { id: 'account-paid', studentId: 'student-paid', service: 'CANTEEN' },
      { id: 'account-due', studentId: 'student-due', service: 'CANTEEN' },
    ]),
    listSegments: vi.fn().mockResolvedValue([segment('account-paid'), segment('account-due')]),
    listLedgers: vi.fn().mockResolvedValue({
      adjustments: [],
      payments: [{ accountId: 'account-paid', amount: 40, unitPrice: 4 }],
    }),
    listPrices: vi
      .fn()
      .mockResolvedValue([{ service: 'CANTEEN', amount: 4, effectiveFrom: '2026-09-01' }]),
    listAbsences: vi.fn().mockResolvedValue([]),
    findClosures: vi.fn().mockResolvedValue(closures),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: String(enabled) }) }
  const run = (startAt: string, endAt: string | null = null, eventId?: string) =>
    mealImpactOfClosure(
      {
        schoolId,
        eventId,
        startAt: new Date(`${startAt}T00:00:00.000Z`),
        endAt: endAt ? new Date(`${endAt}T00:00:00.000Z`) : null,
        today: '2026-09-01',
      },
      accountGw as unknown as AccountGw,
      configGw as unknown as ConfigGw
    )
  return { run }
}

describe('mealImpactOfClosure', () => {
  it('counts children eating on a closed day and those whose paid-through moves', async () => {
    const { run } = setup()

    expect(await run('2026-09-14')).toEqual({ children: 2, moved: 1 })
  })

  it('ignores a closure on a day nobody eats', async () => {
    const { run } = setup()

    expect(await run('2026-09-15', '2026-09-16')).toEqual({ children: 0, moved: 0 })
  })

  it('previews an edited closure against the calendar without it', async () => {
    const existing = {
      id: '0b8f3c2e-7a41-4d5e-9c6b-1f2a3b4c5d6e',
      status: 'PUBLISHED',
      category: 'CLOSURE',
      startAt: new Date('2026-09-14T00:00:00.000Z'),
      endAt: null,
    }
    const { run } = setup({ closures: [existing] })

    expect(await run('2026-09-14', null, existing.id)).toEqual({ children: 2, moved: 1 })
    expect(await run('2026-09-21')).toEqual({ children: 2, moved: 1 })
  })

  it('refuses when meals are off or the dates are reversed', async () => {
    expect(await setup({ enabled: false }).run('2026-09-14')).toBe('mealsDisabled')
    expect(await setup().run('2026-09-14', '2026-09-10')).toBe('validationError')
  })
})
