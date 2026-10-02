import { describe, expect, it, vi } from 'vitest'

vi.mock('@/gateways/family-gateway', () => ({ familyGateway: {} }))

const { findSelectedFamily } = await import('./selected-family')

const FAMILY_ID = '7b1e8f2a-4c3d-4e5f-8a9b-0c1d2e3f4a5b'

function gatewayReturning(family: { id: string; name: string; isActive: boolean } | null) {
  return { findById: vi.fn().mockResolvedValue(family) } as never
}

describe('findSelectedFamily', () => {
  it('returns the id and name of an active family of the school', async () => {
    const gateway = gatewayReturning({ id: FAMILY_ID, name: 'Martin', isActive: true })

    await expect(findSelectedFamily('school-1', FAMILY_ID, gateway)).resolves.toEqual({
      id: FAMILY_ID,
      name: 'Martin',
    })
    expect((gateway as { findById: ReturnType<typeof vi.fn> }).findById).toHaveBeenCalledWith(
      'school-1',
      FAMILY_ID
    )
  })

  it('ignores a value that is not a uuid without querying', async () => {
    const gateway = gatewayReturning(null)

    await expect(findSelectedFamily('school-1', 'Martin', gateway)).resolves.toBeNull()
    expect((gateway as { findById: ReturnType<typeof vi.fn> }).findById).not.toHaveBeenCalled()
  })

  it('ignores a family outside the school or archived', async () => {
    await expect(
      findSelectedFamily('school-1', FAMILY_ID, gatewayReturning(null))
    ).resolves.toBeNull()
    await expect(
      findSelectedFamily(
        'school-1',
        FAMILY_ID,
        gatewayReturning({ id: FAMILY_ID, name: 'Martin', isActive: false })
      )
    ).resolves.toBeNull()
  })
})
