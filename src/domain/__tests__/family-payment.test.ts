import { describe, expect, it } from 'vitest'
import { enrollmentBalances, filterFamilyPaymentsByPeriod, groupFamilyPayments } from '../payment'

const paidAt = new Date('2026-09-12T00:00:00.000Z')
const createdAt = new Date('2026-09-12T10:00:00.000Z')

function line(
  overrides: Partial<Parameters<typeof groupFamilyPayments>[0][number]> & { periodId?: string } = {}
) {
  return {
    id: 'payment-1',
    familyId: 'family-1',
    enrollmentId: 'enrollment-1',
    amount: 90,
    method: 'CASH',
    reference: '34-45',
    paidAt,
    cashedAt: null,
    paymentTransactionId: null,
    createdAt,
    ...overrides,
  }
}

describe('groupFamilyPayments', () => {
  it('shows a payment split across four children as one family payment', () => {
    const lines = ['a', 'b', 'c', 'd'].map((id) =>
      line({ id: `payment-${id}`, enrollmentId: `enrollment-${id}`, amount: 180 })
    )

    const groups = groupFamilyPayments(lines)

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ id: 'payment-a', amount: 720, method: 'CASH' })
    expect(groups[0].lines).toHaveLength(4)
  })

  it('keeps two payments of the same family apart', () => {
    const groups = groupFamilyPayments([
      line({ id: 'first', reference: '34-45' }),
      line({ id: 'second', reference: '34-46' }),
    ])

    expect(groups.map((group) => group.amount)).toEqual([90, 90])
  })

  it('keeps apart identical payments recorded at different times', () => {
    const groups = groupFamilyPayments([
      line({ id: 'first', reference: null }),
      line({ id: 'second', reference: null, createdAt: new Date('2026-09-12T11:00:00.000Z') }),
    ])

    expect(groups).toHaveLength(2)
  })

  it('never puts the same enrollment twice in one payment', () => {
    const groups = groupFamilyPayments([line({ id: 'first' }), line({ id: 'second' })])

    expect(groups).toHaveLength(2)
  })

  it('keeps apart two families paying the same way', () => {
    const groups = groupFamilyPayments([
      line({ id: 'first' }),
      line({ id: 'second', familyId: 'family-2', enrollmentId: 'enrollment-2' }),
    ])

    expect(groups).toHaveLength(2)
  })

  it('sums decimal amounts without float drift', () => {
    const groups = groupFamilyPayments([
      line({ id: 'first', amount: { toString: () => '33.33' } }),
      line({ id: 'second', enrollmentId: 'enrollment-2', amount: { toString: () => '33.34' } }),
    ])

    expect(groups[0].amount).toBe(66.67)
  })

  it('lists the latest payment first', () => {
    const groups = groupFamilyPayments([
      line({ id: 'older', reference: '1' }),
      line({ id: 'newer', reference: '2', paidAt: new Date('2027-02-03T00:00:00.000Z') }),
    ])

    expect(groups.map((group) => group.id)).toEqual(['newer', 'older'])
  })

  it('chains lines written a few seconds apart into one payment', () => {
    const at = (seconds: number) => new Date(createdAt.getTime() + seconds * 1000)
    const groups = groupFamilyPayments([
      line({ id: 'a', enrollmentId: 'enrollment-a', createdAt: at(0) }),
      line({ id: 'b', enrollmentId: 'enrollment-b', createdAt: at(4) }),
      line({ id: 'c', enrollmentId: 'enrollment-c', createdAt: at(8) }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].amount).toBe(270)
  })

  it('groups an online payment by its transaction', () => {
    const groups = groupFamilyPayments([
      line({
        id: 'a',
        enrollmentId: 'enrollment-a',
        method: 'CARD',
        reference: null,
        paymentTransactionId: 'tx-1',
      }),
      line({
        id: 'b',
        enrollmentId: 'enrollment-b',
        method: 'CARD',
        reference: null,
        paymentTransactionId: 'tx-1',
      }),
      line({
        id: 'c',
        enrollmentId: 'enrollment-a',
        method: 'CARD',
        reference: null,
        paymentTransactionId: 'tx-2',
      }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.lines.length).sort()).toEqual([1, 2])
  })
})

describe('filterFamilyPaymentsByPeriod', () => {
  it('keeps the full amount of a payment split across two periods', () => {
    const groups = groupFamilyPayments([
      line({ id: 'a', enrollmentId: 'enrollment-a', amount: 90, periodId: 'period-1' }),
      line({ id: 'b', enrollmentId: 'enrollment-b', amount: 90, periodId: 'period-2' }),
    ])

    const scoped = filterFamilyPaymentsByPeriod(groups, (l) => l.periodId === 'period-1')

    expect(scoped).toHaveLength(1)
    expect(scoped[0].amount).toBe(180)
    expect(scoped[0].periodAmount).toBe(90)
    expect(scoped[0].lines).toHaveLength(2)
  })

  it('drops a payment with no line in the selected period', () => {
    const groups = groupFamilyPayments([line({ id: 'a', periodId: 'period-2' })])

    const scoped = filterFamilyPaymentsByPeriod(groups, (l) => l.periodId === 'period-1')

    expect(scoped).toHaveLength(0)
  })

  it('reports the full amount as the period share when every line matches', () => {
    const groups = groupFamilyPayments([
      line({ id: 'a', enrollmentId: 'enrollment-a', amount: 90, periodId: 'period-1' }),
      line({ id: 'b', enrollmentId: 'enrollment-b', amount: 90, periodId: 'period-1' }),
    ])

    const scoped = filterFamilyPaymentsByPeriod(groups, (l) => l.periodId === 'period-1')

    expect(scoped[0].amount).toBe(180)
    expect(scoped[0].periodAmount).toBe(180)
  })
})

describe('enrollmentBalances', () => {
  it('computes what is left on each enrollment, rounded to the cent', () => {
    expect(
      enrollmentBalances([
        {
          id: 'e1',
          totalAmount: 180,
          discount: 0,
          payments: [{ amount: 33.333 }, { amount: 33.333 }],
        },
      ])
    ).toEqual([{ enrollmentId: 'e1', totalAmount: 180, discount: 0, remainingBalance: 113.33 }])
  })

  it('floors an overpaid enrollment at zero and keeps it for refunds', () => {
    expect(
      enrollmentBalances([{ id: 'e1', totalAmount: 100, discount: 0, payments: [{ amount: 120 }] }])
    ).toEqual([{ enrollmentId: 'e1', totalAmount: 100, discount: 0, remainingBalance: 0 }])
  })
})
