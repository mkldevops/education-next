import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolAdminMock = vi.fn()
const findMembershipMock = vi.fn()
const findActiveByIdMock = vi.fn()
const sendInvitationEmailMock = vi.fn()

const dbMock = {
  user: { findUnique: vi.fn() },
  familyPerson: { findUnique: vi.fn() },
  invitation: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next-intl/server', () => ({ getLocale: async () => 'fr' }))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/gateways/school-gateway', () => ({
  schoolGateway: { findActiveById: findActiveByIdMock },
}))
vi.mock('@/gateways/school-member-gateway', () => ({
  schoolMemberGateway: { findMembership: findMembershipMock },
}))
vi.mock('./auth-helper', () => ({ requireSchoolAdmin: requireSchoolAdminMock }))
vi.mock('./invitation-email', () => ({
  resolveInvitationLocale: (value: string) => value,
  sendInvitationEmail: sendInvitationEmailMock,
}))

const { inviteUserAction } = await import('./invitation-actions')

const INPUT = { email: 'parent@school.test', role: 'PARENT' }

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({ schoolId: 'school-b', userId: 'admin-1' })
  findActiveByIdMock.mockResolvedValue({ id: 'school-b', name: 'Horizon', slug: 'horizon' })
  dbMock.user.findUnique.mockResolvedValue(null)
  findMembershipMock.mockResolvedValue(null)
  sendInvitationEmailMock.mockResolvedValue('OK')
})

describe('inviteUserAction', () => {
  it('invites an account that already exists in another school', async () => {
    dbMock.user.findUnique.mockResolvedValue({ id: 'user-1' })

    expect(await inviteUserAction(INPUT)).toBe('OK')
    expect(findMembershipMock).toHaveBeenCalledWith('user-1', 'school-b')
    expect(dbMock.invitation.create).toHaveBeenCalled()
  })

  it('refuses an account already member of the target school', async () => {
    dbMock.user.findUnique.mockResolvedValue({ id: 'user-1' })
    findMembershipMock.mockResolvedValue({ userId: 'user-1', schoolId: 'school-b' })

    expect(await inviteUserAction(INPUT)).toBe('alreadyMember')
    expect(dbMock.invitation.create).not.toHaveBeenCalled()
  })

  it('still invites an unknown address without consulting memberships', async () => {
    expect(await inviteUserAction(INPUT)).toBe('OK')
    expect(findMembershipMock).not.toHaveBeenCalled()
  })

  it('names the inviting school in the email', async () => {
    await inviteUserAction(INPUT)

    expect(sendInvitationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: INPUT.email, schoolName: 'Horizon' })
    )
  })

  it('scopes the invitation to the school of the acting admin', async () => {
    await inviteUserAction(INPUT)

    expect(dbMock.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ schoolId: 'school-b' }) })
    )
  })
})
