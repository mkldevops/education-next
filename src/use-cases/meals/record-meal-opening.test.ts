import { describe, expect, it, vi } from 'vitest'
import { recordMealOpening } from './record-meal-opening'

type AccountGw = Parameters<typeof recordMealOpening>[1]
type ConfigGw = Parameters<typeof recordMealOpening>[2]

const schoolId = 'school-a'
const studentId = '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f'
const tx = { tx: true }

function setup(segments: unknown[] = [], closures: unknown[] = []) {
  const accountGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    lockAccount: vi.fn().mockResolvedValue('account-1'),
    listSegments: vi.fn().mockResolvedValue(segments),
    findClosures: vi.fn().mockResolvedValue(closures),
    replaceOpening: vi.fn().mockResolvedValue({}),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: 'true' }) }
  const run = (input: Partial<Parameters<typeof recordMealOpening>[0]> = {}) =>
    recordMealOpening(
      {
        schoolId,
        studentId,
        service: 'CANTEEN',
        paidThrough: '2026-09-18',
        reason: 'Cahier papier',
        recordedById: 'admin-1',
        ...input,
      },
      accountGw as unknown as AccountGw,
      configGw as unknown as ConfigGw
    )
  return { accountGw, run }
}

// Lundi 7 septembre au vendredi 18 : lundi, mardi, jeudi, vendredi.
const segment = {
  id: 's',
  periodId: 'p',
  weekdays: [1, 2, 4, 5],
  startOn: '2026-09-07',
  endOn: null,
  periodEnd: '2027-07-03',
}

describe('recordMealOpening', () => {
  it('turns "paid through" into the served days up to that date', async () => {
    const { accountGw, run } = setup([segment])

    expect(await run()).toBe('OK')
    expect(accountGw.replaceOpening).toHaveBeenCalledWith(tx, schoolId, {
      accountId: 'account-1',
      days: 8,
      reason: 'Cahier papier',
      recordedById: 'admin-1',
    })
  })

  it('does not count a closure day', async () => {
    const closure = {
      status: 'PUBLISHED',
      category: 'CLOSURE',
      startAt: new Date('2026-09-10T00:00:00.000Z'),
      endAt: new Date('2026-09-10T23:59:59.000Z'),
    }
    const { accountGw, run } = setup([segment], [closure])

    await run()
    expect(accountGw.replaceOpening).toHaveBeenCalledWith(
      tx,
      schoolId,
      expect.objectContaining({ days: 7 })
    )
  })

  it('refuses a child without segment and an empty reason', async () => {
    expect(await setup([]).run()).toBe('notSubscribed')
    expect(await setup([segment]).run({ reason: '  ' })).toBe('validationError')
  })
})
