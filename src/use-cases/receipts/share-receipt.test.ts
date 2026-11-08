import { describe, expect, it, vi } from 'vitest'
import { ensureReceiptShareToken, findReceiptRecipients, newShareToken } from './share-receipt'

type ReceiptGw = Parameters<typeof ensureReceiptShareToken>[2]

const receiptId = '5d1c9a2e-8b7f-4e3d-a6c5-b4a39281706f'

function gateway(overrides: Record<string, unknown> = {}) {
  return {
    ensureShareToken: vi.fn().mockResolvedValue({ shareToken: 'token-1', cancelledAt: null }),
    findFamilyRecipients: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ReceiptGw & {
    ensureShareToken: ReturnType<typeof vi.fn>
    findFamilyRecipients: ReturnType<typeof vi.fn>
  }
}

describe('ensureReceiptShareToken', () => {
  it('returns the token of a receipt of the school, scoped by school', async () => {
    const receiptGw = gateway()

    expect(await ensureReceiptShareToken('school-a', receiptId, receiptGw, () => 'new')).toEqual({
      token: 'token-1',
    })
    expect(receiptGw.ensureShareToken).toHaveBeenCalledWith('school-a', receiptId, 'new')
  })

  it('treats a receipt of another school as missing', async () => {
    const receiptGw = gateway({ ensureShareToken: vi.fn().mockResolvedValue(null) })

    expect(await ensureReceiptShareToken('school-b', receiptId, receiptGw)).toBe('notFound')
  })

  it('gives no link to a cancelled receipt', async () => {
    const receiptGw = gateway({
      ensureShareToken: vi
        .fn()
        .mockResolvedValue({ shareToken: 'token-1', cancelledAt: new Date('2026-11-01') }),
    })

    expect(await ensureReceiptShareToken('school-a', receiptId, receiptGw)).toBe('cancelled')
  })

  it('rejects a malformed id before reading', async () => {
    const receiptGw = gateway()

    expect(await ensureReceiptShareToken('school-a', 'nope', receiptGw)).toBe('notFound')
    expect(receiptGw.ensureShareToken).not.toHaveBeenCalled()
  })
})

describe('newShareToken', () => {
  it('draws an unguessable url-safe token', () => {
    const token = newShareToken()

    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(newShareToken()).not.toBe(token)
  })
})

describe('findReceiptRecipients', () => {
  it('keeps each parent address once', async () => {
    const receiptGw = gateway({
      findFamilyRecipients: vi
        .fn()
        .mockResolvedValue([
          { person: { name: 'A', email: 'Parent@Mail.test ' } },
          { person: { name: 'B', email: 'parent@mail.test' } },
          { person: { name: 'C', email: 'tutor@mail.test' } },
        ]),
    })

    expect(await findReceiptRecipients('school-a', 'family-1', receiptGw)).toEqual([
      'parent@mail.test',
      'tutor@mail.test',
    ])
    expect(receiptGw.findFamilyRecipients).toHaveBeenCalledWith('school-a', 'family-1')
  })
})
