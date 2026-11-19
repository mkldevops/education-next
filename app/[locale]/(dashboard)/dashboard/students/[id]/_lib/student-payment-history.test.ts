import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  payment: { findMany: vi.fn() },
  mealPayment: { findMany: vi.fn() },
  childcarePayment: { findMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ db }))

const { getStudentPaymentHistory } = await import('./student-payment-history')

const tuition = (
  id: string,
  paidAt: string,
  amount: string,
  period: string | null = '2026-2027'
) => ({
  id,
  amount,
  method: 'CASH',
  paidAt: new Date(paidAt),
  enrollment: {
    classAssignments: period ? [{ classPeriod: { period: { name: period } } }] : [],
  },
})

const meal = (id: string, paidAt: string, service: 'CANTEEN' | 'SNACK') => ({
  id,
  amount: '42.50',
  daysAdded: 10,
  paidThroughAtReceipt: new Date('2026-11-30T00:00:00.000Z'),
  account: { service },
  receipt: { paidAt: new Date(paidAt), method: 'CARD' },
})

const childcare = (id: string, paidAt: string) => ({
  id,
  amount: '60',
  charge: { month: new Date('2026-10-01T00:00:00.000Z') },
  receipt: { paidAt: new Date(paidAt), method: 'TRANSFER' },
})

describe('getStudentPaymentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.payment.findMany.mockResolvedValue([])
    db.mealPayment.findMany.mockResolvedValue([])
    db.childcarePayment.findMany.mockResolvedValue([])
  })

  it('merges tuition, meal and childcare lines newest first with what each covers', async () => {
    db.payment.findMany.mockResolvedValue([tuition('p1', '2026-09-05T00:00:00.000Z', '150')])
    db.mealPayment.findMany.mockResolvedValue([
      meal('m1', '2026-11-02T08:15:00.000Z', 'CANTEEN'),
      meal('m2', '2026-10-01T08:15:00.000Z', 'SNACK'),
    ])
    db.childcarePayment.findMany.mockResolvedValue([childcare('c1', '2026-10-15T09:00:00.000Z')])

    const history = await getStudentPaymentHistory('school-a', 'student-1', {
      includeServices: true,
    })

    expect(history.hasMore).toBe(false)
    expect(history.entries.map((entry) => [entry.id, entry.service, entry.amount])).toEqual([
      ['meal:m1', 'CANTEEN', 42.5],
      ['childcare:c1', 'CHILDCARE', 60],
      ['meal:m2', 'SNACK', 42.5],
      ['tuition:p1', 'TUITION', 150],
    ])
    expect(history.entries[1]).toMatchObject({
      method: 'TRANSFER',
      coverage: { kind: 'month', month: '2026-10' },
    })
    expect(history.entries[0].coverage).toEqual({
      kind: 'mealDays',
      days: 10,
      paidThrough: new Date('2026-11-30T00:00:00.000Z'),
    })
    expect(history.entries[3].coverage).toEqual({ kind: 'period', name: '2026-2027' })
  })

  it('scopes every source to the school and the student and drops cancelled lines', async () => {
    await getStudentPaymentHistory('school-a', 'student-1', { includeServices: true })

    expect(db.payment.findMany.mock.calls[0][0].where).toEqual({
      schoolId: 'school-a',
      isActive: true,
      enrollment: { schoolId: 'school-a', studentId: 'student-1' },
    })
    expect(db.mealPayment.findMany.mock.calls[0][0].where).toEqual({
      schoolId: 'school-a',
      account: { schoolId: 'school-a', studentId: 'student-1' },
      receipt: { cancelledAt: null },
    })
    expect(db.childcarePayment.findMany.mock.calls[0][0].where).toEqual({
      schoolId: 'school-a',
      charge: { subscription: { schoolId: 'school-a', studentId: 'student-1' } },
      receipt: { cancelledAt: null },
    })
  })

  it('reads only tuition when the meal module is off', async () => {
    db.payment.findMany.mockResolvedValue([tuition('p1', '2026-09-05T00:00:00.000Z', '150', null)])

    const history = await getStudentPaymentHistory('school-a', 'student-1', {
      includeServices: false,
    })

    expect(db.mealPayment.findMany).not.toHaveBeenCalled()
    expect(db.childcarePayment.findMany).not.toHaveBeenCalled()
    expect(history.entries).toHaveLength(1)
    expect(history.entries[0].coverage).toEqual({ kind: 'period', name: null })
  })

  it('keeps the most recent lines up to the limit and says older ones exist', async () => {
    db.payment.findMany.mockResolvedValue([
      tuition('p1', '2026-09-03T00:00:00.000Z', '10'),
      tuition('p2', '2026-09-01T00:00:00.000Z', '10'),
    ])
    db.mealPayment.findMany.mockResolvedValue([meal('m1', '2026-09-02T08:00:00.000Z', 'CANTEEN')])

    const history = await getStudentPaymentHistory(
      'school-a',
      'student-1',
      { includeServices: true },
      2
    )

    expect(db.payment.findMany.mock.calls[0][0].take).toBe(3)
    expect(history.entries.map((entry) => entry.id)).toEqual(['tuition:p1', 'meal:m1'])
    expect(history.hasMore).toBe(true)
  })
})
