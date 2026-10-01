import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Invitation, Prisma } from '@/generated/prisma/client'
import { linkInvitedUser } from './link-invited-user'

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
    },
    teacher: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    userFamily: { upsert: vi.fn() },
    invitation: {
      updateMany: vi.fn().mockResolvedValue({ count: overrides.closedCount ?? 1 }),
    },
  }
}

const asTx = (tx: ReturnType<typeof createTx>) => tx as unknown as Prisma.TransactionClient

beforeEach(() => {
  vi.clearAllMocks()
})

describe('linkInvitedUser', () => {
  it('creates the membership and the family link of the invited school', async () => {
    const tx = createTx()

    expect(await linkInvitedUser(asTx(tx), INVITATION, 'user-1')).toBe('OK')
    expect(tx.schoolMember.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', schoolId: 'school-b', role: 'PARENT' },
    })
    expect(tx.userFamily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'user-1', familyId: 'family-b', schoolId: 'school-b' },
      })
    )
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

  it('refuses a user who already belongs to the target school', async () => {
    const tx = createTx({ membership: { userId: 'user-1' } })

    expect(await linkInvitedUser(asTx(tx), INVITATION, 'user-1')).toBe('alreadyMember')
    expect(tx.invitation.updateMany).not.toHaveBeenCalled()
    expect(tx.schoolMember.create).not.toHaveBeenCalled()
  })

  it('adds a teacher capability to an existing admin or parent without replacing membership', async () => {
    const tx = createTx({ membership: { userId: 'user-1' } })

    expect(
      await linkInvitedUser(
        asTx(tx),
        { ...INVITATION, role: 'TEACHER', familyId: null, teacherId: 'teacher-1' },
        'user-1'
      )
    ).toBe('OK')

    expect(tx.schoolMember.create).not.toHaveBeenCalled()
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

  it('skips the family link when the invitation carries no family', async () => {
    const tx = createTx()

    await linkInvitedUser(asTx(tx), { ...INVITATION, familyId: null }, 'user-1')

    expect(tx.userFamily.upsert).not.toHaveBeenCalled()
  })
})
