import { describe, expect, it } from 'vitest'
import { MCP_DRAFT_CHECKSUM_LENGTH } from '@/domain/mcp-draft'
import { draftChecksum } from '../mcp-draft-crypto'

describe('draftChecksum', () => {
  it('produces a fixed-width hexadecimal fragment', () => {
    expect(draftChecksum({ familyName: 'Bouhahima' })).toMatch(
      new RegExp(`^[0-9a-f]{${MCP_DRAFT_CHECKSUM_LENGTH}}$`)
    )
  })

  it('ignores key order, so a plan rebuilt differently still commits', () => {
    const left = { familyName: 'Madi', plan: { amount: 90, name: 'Tarif' } }
    const right = { plan: { name: 'Tarif', amount: 90 }, familyName: 'Madi' }

    expect(draftChecksum(left)).toBe(draftChecksum(right))
  })

  it('keeps array order significant, because allocation order is the payment split', () => {
    const left = { allocation: [{ amount: 60 }, { amount: 30 }] }
    const right = { allocation: [{ amount: 30 }, { amount: 60 }] }

    expect(draftChecksum(left)).not.toBe(draftChecksum(right))
  })

  it('changes as soon as a single value changes', () => {
    expect(draftChecksum({ amount: 100 })).not.toBe(draftChecksum({ amount: 101 }))
  })

  it('treats an absent key and an explicit undefined as the same plan', () => {
    expect(draftChecksum({ name: 'Ali', reference: undefined })).toBe(
      draftChecksum({ name: 'Ali' })
    )
  })

  it('separates a null from an absent key, which are different plans', () => {
    expect(draftChecksum({ name: 'Ali', payment: null })).not.toBe(draftChecksum({ name: 'Ali' }))
  })
})
