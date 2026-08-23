import { beforeEach, describe, expect, it, vi } from 'vitest'

const userGatewayMock = {
  findManaged: vi.fn(),
  hasFamilyLink: vi.fn(),
  linkFamily: vi.fn(),
  unlinkFamily: vi.fn(),
}

const familyGatewayMock = {
  findById: vi.fn(),
}

vi.mock('@/gateways/user-gateway', () => ({
  userGateway: userGatewayMock,
}))

vi.mock('@/gateways/family-gateway', () => ({
  familyGateway: familyGatewayMock,
}))

const { linkUserFamily, unlinkUserFamily } = await import('./link-user-family')

const schoolId = 'school-1'
const targetId = 'cm0target0000000000000000'
const familyId = '018f5f4a-0000-7000-8000-000000000001'

describe('linkUserFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userGatewayMock.findManaged.mockResolvedValue({ id: targetId })
    familyGatewayMock.findById.mockResolvedValue({ id: familyId })
    userGatewayMock.hasFamilyLink.mockResolvedValue(null)
  })

  it('rejects an empty id', async () => {
    expect(await linkUserFamily(schoolId, { id: '', familyId })).toBe('validationError')
  })

  // `Family.id` est généré par Prisma : son format, lui, est contraint.
  it('rejects a familyId that is not a uuid', async () => {
    expect(await linkUserFamily(schoolId, { id: targetId, familyId: 'nope' })).toBe(
      'validationError'
    )
  })

  it('returns notFound for an unknown user', async () => {
    userGatewayMock.findManaged.mockResolvedValue(null)
    expect(await linkUserFamily(schoolId, { id: targetId, familyId })).toBe('notFound')
  })

  it('returns familyNotFound when the family is outside the active school', async () => {
    familyGatewayMock.findById.mockResolvedValue(null)
    expect(await linkUserFamily(schoolId, { id: targetId, familyId })).toBe('familyNotFound')
    expect(familyGatewayMock.findById).toHaveBeenCalledWith(schoolId, familyId)
  })

  it('returns alreadyLinked for an existing school-scoped link', async () => {
    userGatewayMock.hasFamilyLink.mockResolvedValue({ userId: targetId })
    expect(await linkUserFamily(schoolId, { id: targetId, familyId })).toBe('alreadyLinked')
    expect(userGatewayMock.hasFamilyLink).toHaveBeenCalledWith(targetId, familyId, schoolId)
  })

  it('links the user to the active school family', async () => {
    expect(await linkUserFamily(schoolId, { id: targetId, familyId })).toBe('OK')
    expect(userGatewayMock.linkFamily).toHaveBeenCalledWith(targetId, familyId, schoolId)
  })
})

describe('unlinkUserFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userGatewayMock.hasFamilyLink.mockResolvedValue(null)
  })

  it('returns notFound when the school-scoped link is absent', async () => {
    expect(await unlinkUserFamily(schoolId, { id: targetId, familyId })).toBe('notFound')
    expect(userGatewayMock.hasFamilyLink).toHaveBeenCalledWith(targetId, familyId, schoolId)
  })

  it('unlinks an existing school-scoped link', async () => {
    userGatewayMock.hasFamilyLink.mockResolvedValue({ userId: targetId })
    expect(await unlinkUserFamily(schoolId, { id: targetId, familyId })).toBe('OK')
    expect(userGatewayMock.unlinkFamily).toHaveBeenCalledWith(targetId, familyId, schoolId)
  })
})
