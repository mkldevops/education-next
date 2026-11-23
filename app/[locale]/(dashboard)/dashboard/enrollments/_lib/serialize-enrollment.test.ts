import { describe, expect, it } from 'vitest'
import { serializeEnrollment } from './serialize-enrollment'

const decimal = (value: number) => ({ toString: () => String(value) })

const enrollment = {
  id: 'enrollment-1',
  status: 'ACTIVE',
  totalAmount: decimal(71234),
  discount: decimal(2345),
  writeOffAmount: decimal(1987),
  firstInstallmentAmount: decimal(5432),
  plan: {
    name: 'Mensuel',
    amount: decimal(98765),
    pricing: { tiers: [{ amount: 8642 }] },
  },
  payments: [{ id: 'payment-1', amount: decimal(13579) }],
}

const amounts = ['71234', '2345', '1987', '5432', '98765', '8642', '13579']

describe('serializeEnrollment', () => {
  it('sends no financial field to a caller who is not an admin', () => {
    const payload = serializeEnrollment(enrollment, { isAdmin: false })

    expect(payload).toMatchObject({
      id: 'enrollment-1',
      status: 'ACTIVE',
      totalAmount: 0,
      discount: 0,
      writeOffAmount: null,
      firstInstallmentAmount: null,
      plan: { name: 'Mensuel', amount: 0, pricing: null },
      payments: [],
    })
    const serialized = JSON.stringify(payload)
    for (const amount of amounts) expect(serialized).not.toContain(amount)
  })

  it('keeps no reduced first month for a non-admin when it is the only amount set', () => {
    const payload = serializeEnrollment(
      { ...enrollment, writeOffAmount: null, payments: [] },
      { isAdmin: false }
    )

    expect(payload.firstInstallmentAmount).toBeNull()
    expect(JSON.stringify(payload)).not.toContain('5432')
  })

  it('hands an admin plain numbers instead of Decimals', () => {
    const payload = serializeEnrollment(enrollment, { isAdmin: true })

    expect(payload).toEqual({
      id: 'enrollment-1',
      status: 'ACTIVE',
      totalAmount: 71234,
      discount: 2345,
      writeOffAmount: 1987,
      firstInstallmentAmount: 5432,
      plan: { name: 'Mensuel', amount: 98765, pricing: { tiers: [{ amount: 8642 }] } },
      payments: [{ id: 'payment-1', amount: 13579 }],
    })
  })

  it('keeps an unset reduced first month null for an admin', () => {
    const payload = serializeEnrollment(
      { ...enrollment, firstInstallmentAmount: null, writeOffAmount: null },
      { isAdmin: true }
    )

    expect(payload.firstInstallmentAmount).toBeNull()
    expect(payload.writeOffAmount).toBeNull()
  })
})
