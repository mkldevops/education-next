import { describe, expect, it } from 'vitest'
import { paymentTrackingState } from './payment-tracking-state'

const tracking = (overrides = {}) => ({
  expectedToDate: 300,
  overdueAmount: 0,
  dueThisMonth: 0,
  tracked: true,
  annualAmount: 1000,
  creditedPaid: 300,
  ...overrides,
})

describe('paymentTrackingState', () => {
  it.each([
    [{ tracked: false }, 'untracked'],
    [{ creditedPaid: 1000 }, 'settled'],
    [{ overdueAmount: 50, dueThisMonth: 150 }, 'late'],
    [{ dueThisMonth: 100 }, 'due'],
    [{ creditedPaid: 480 }, 'ahead'],
    [{}, 'upToDate'],
  ] as const)('%j → %s', (overrides, state) => {
    expect(paymentTrackingState(tracking(overrides))).toBe(state)
  })
})
