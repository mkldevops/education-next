import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolAdminMock = vi.fn()
const findMembershipMock = vi.fn()
const findActiveByIdMock = vi.fn()
const sendInvitationEmailMock = vi.fn()

const dbMock = {
  user: { findUnique: vi.fn() },
  familyPerson: { findUnique: vi.fn() },
  teacher: { findUnique: vi.fn() },
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
const TEACHER_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({ schoolId: 'school-b', userId: 'admin-1' })
  findActiveByIdMock.mockResolvedValue({ id: 'school-b', name: 'Horizon', slug: 'horizon' })
  dbMock.user.findUnique.mockResolvedValue(null)
  dbMock.invitation.create.mockResolvedValue({ id: 'invitation-1' })
  findMembershipMock.mockResolvedValue(null)
  sendInvitationEmailMock.mockResolvedValue('OK')
  dbMock.teacher.findUnique.mockResolvedValue({
    id: TEACHER_ID,
    email: 'teacher@school.test',
    userId: null,
  })
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

  it('allows a teacher invitation to add a capability to an existing member', async () => {
    dbMock.user.findUnique.mockResolvedValue({ id: 'user-1' })
    findMembershipMock.mockResolvedValue({ userId: 'user-1', schoolId: 'school-b', role: 'ADMIN' })

    expect(
      await inviteUserAction({
        email: 'teacher@school.test',
        role: 'TEACHER',
        teacherId: TEACHER_ID,
      })
    ).toBe('OK')
    expect(dbMock.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ teacherId: TEACHER_ID }) })
    )
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

  it('normalizes the address, so a mixed-case invite still sees the existing account', async () => {
    // Better Auth écrit `User.email` en minuscules : sans normalisation à l'entrée, la
    // recherche du compte échoue et l'appartenance n'est jamais consultée.
    dbMock.user.findUnique.mockImplementation(async ({ where }: { where: { email: string } }) =>
      where.email === 'parent@school.test' ? { id: 'user-1' } : null
    )
    findMembershipMock.mockResolvedValue({ userId: 'user-1', schoolId: 'school-b' })

    expect(await inviteUserAction({ email: 'Parent@School.TEST', role: 'PARENT' })).toBe(
      'alreadyMember'
    )
  })

  it('stores the invited address in lower case', async () => {
    await inviteUserAction({ email: 'Parent@School.TEST', role: 'PARENT' })

    expect(dbMock.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'parent@school.test' }) })
    )
    expect(sendInvitationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'parent@school.test' })
    )
  })

  it('scopes the invitation to the school of the acting admin', async () => {
    await inviteUserAction(INPUT)

    expect(dbMock.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ schoolId: 'school-b' }) })
    )
  })
})
