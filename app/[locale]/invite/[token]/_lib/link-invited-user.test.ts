import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Invitation, Prisma } from '@/generated/prisma/client'
import { linkInvitedUser } from './link-invited-user'

const lockActiveFamilyMock = vi.fn()
vi.mock('@/gateways/family-mutation-lock', () => ({
  lockActiveFamily: (...args: unknown[]) => lockActiveFamilyMock(...args),
}))

const INVITATION = {
  id: 'invitation-1',
  schoolId: 'school-b',
  email: 'parent@school.test',
  role: 'PARENT',
  familyId: 'family-b',
} as unknown as Invitation

function createTx(overrides: { membership?: unknown; closedCount?: number } = {}) {
  return {
    schoolMember: {
      findUnique: vi.fn().mockResolvedValue(overrides.membership ?? null),
      create: vi.fn(),
      update: vi.fn(),
    },
    teacher: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    userFamily: { upsert: vi.fn() },
    invitation: {
      findUnique: vi.fn().mockResolvedValue({ familyId: 'family-b' }),
      updateMany: vi.fn().mockResolvedValue({ count: overrides.closedCount ?? 1 }),
    },
  }
}

const asTx = (tx: ReturnType<typeof createTx>) => tx as unknown as Prisma.TransactionClient

beforeEach(() => {
  vi.clearAllMocks()
  lockActiveFamilyMock.mockResolvedValue(true)
})

describe('linkInvitedUser', () => {
  it('creates the membership and the family link of the invited school', async () => {
    const tx = createTx()

    expect(await linkInvitedUser(asTx(tx), INVITATION, 'user-1')).toBe('OK')
    expect(tx.schoolMember.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', schoolId: 'school-b', roles: ['PARENT'] },
    })
    expect(tx.userFamily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'user-1', familyId: 'family-b', schoolId: 'school-b' },
      })
    )
  })

  it('relinks the teacher profile of a member already holding the teacher role', async () => {
    const tx = createTx({ membership: { roles: ['TEACHER'] } })

    expect(
      await linkInvitedUser(
        asTx(tx),
        { ...INVITATION, role: 'TEACHER', familyId: null, teacherId: 'teacher-1' },
        'user-1'
      )
    ).toBe('OK')

    expect(tx.schoolMember.update).not.toHaveBeenCalled()
    expect(tx.teacher.updateMany).toHaveBeenCalled()
  })

  it('closes the invitation only while it is still open', async () => {
    const tx = createTx()

    await linkInvitedUser(asTx(tx), INVITATION, 'user-1')

    expect(tx.invitation.updateMany).toHaveBeenCalledWith({
      where: { id: 'invitation-1', schoolId: 'school-b', usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
  })

  it('writes nothing when a concurrent acceptance closed the invitation first', async () => {
    const tx = createTx({ closedCount: 0 })

    expect(await linkInvitedUser(asTx(tx), INVITATION, 'user-1')).toBe('alreadyUsed')
    expect(tx.schoolMember.create).not.toHaveBeenCalled()
    expect(tx.userFamily.upsert).not.toHaveBeenCalled()
  })

  it('refuses a user who already holds the invited role', async () => {
    const tx = createTx({ membership: { roles: ['ADMIN', 'PARENT'] } })

    expect(await linkInvitedUser(asTx(tx), INVITATION, 'user-1')).toBe('alreadyMember')
    expect(tx.invitation.updateMany).not.toHaveBeenCalled()
    expect(tx.schoolMember.create).not.toHaveBeenCalled()
    expect(tx.schoolMember.update).not.toHaveBeenCalled()
  })

  it('adds the invited role to a member who holds another one', async () => {
    const tx = createTx({ membership: { roles: ['TEACHER'] } })

    expect(await linkInvitedUser(asTx(tx), INVITATION, 'user-1')).toBe('OK')
    expect(tx.schoolMember.create).not.toHaveBeenCalled()
    expect(tx.schoolMember.update).toHaveBeenCalledWith({
      where: { userId_schoolId: { userId: 'user-1', schoolId: 'school-b' } },
      data: { roles: ['TEACHER', 'PARENT'] },
    })
    expect(tx.userFamily.upsert).toHaveBeenCalled()
  })

  it('adds a teacher capability to an existing admin or parent without replacing membership', async () => {
    const tx = createTx({ membership: { roles: ['PARENT', 'ADMIN'] } })

    expect(
      await linkInvitedUser(
        asTx(tx),
        { ...INVITATION, role: 'TEACHER', familyId: null, teacherId: 'teacher-1' },
        'user-1'
      )
    ).toBe('OK')

    expect(tx.schoolMember.create).not.toHaveBeenCalled()
    expect(tx.schoolMember.update).toHaveBeenCalledWith({
      where: { userId_schoolId: { userId: 'user-1', schoolId: 'school-b' } },
      data: { roles: ['ADMIN', 'TEACHER', 'PARENT'] },
    })
    expect(tx.teacher.updateMany).toHaveBeenCalledWith({
      where: { id: 'teacher-1', schoolId: 'school-b', userId: null, isActive: true },
      data: { userId: 'user-1' },
    })
  })

  it('refuses to bind a teacher profile archived since the invitation was sent', async () => {
    // L'extension soft-delete ne couvre pas `updateMany` : une fiche archivée n'est
    // trouvée que parce que le `where` porte `isActive: true` ; sinon le compte serait
    // lié à une fiche archivée et l'appartenance TEACHER créée sans capacité.
    const tx = createTx()
    tx.teacher.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      linkInvitedUser(
        asTx(tx),
        { ...INVITATION, role: 'TEACHER', familyId: null, teacherId: 'teacher-1' },
        'user-1'
      )
    ).rejects.toThrow('teacherLinkUnavailable')

    expect(tx.userFamily.upsert).not.toHaveBeenCalled()
  })

  it('uses the current family after the invitation was moved by a merge', async () => {
    const tx = createTx()
    tx.invitation.findUnique.mockResolvedValue({ familyId: 'merged-family' })
    expect(await linkInvitedUser(asTx(tx), INVITATION, 'user-1')).toBe('OK')
    expect(lockActiveFamilyMock).toHaveBeenCalledWith(tx, 'school-b', 'merged-family')
    expect(tx.userFamily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'user-1', familyId: 'merged-family', schoolId: 'school-b' },
      })
    )
  })

  it('does not consume the token or grant access if the family changed before locking', async () => {
    const tx = createTx()
    lockActiveFamilyMock.mockResolvedValue(false)
    await expect(linkInvitedUser(asTx(tx), INVITATION, 'user-1')).rejects.toThrow(
      'familyLinkUnavailable'
    )
    expect(tx.invitation.updateMany).not.toHaveBeenCalled()
    expect(tx.schoolMember.create).not.toHaveBeenCalled()
    expect(tx.userFamily.upsert).not.toHaveBeenCalled()
  })

  it('skips the family link when the invitation carries no family', async () => {
    const tx = createTx()

    await linkInvitedUser(asTx(tx), { ...INVITATION, familyId: null }, 'user-1')

    expect(tx.userFamily.upsert).not.toHaveBeenCalled()
  })
})
