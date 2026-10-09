import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolAdminMock = vi.fn()
const findMembershipMock = vi.fn()
const findActiveByIdMock = vi.fn()
const sendInvitationEmailMock = vi.fn()

const dbMock = {
  user: { findUnique: vi.fn() },
  familyPerson: { findFirst: vi.fn() },
  teacher: { findUnique: vi.fn() },
  invitation: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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

const { inviteTeacherAction, inviteUserAction } = await import('./invitation-actions')

const INPUT = { email: 'parent@school.test', role: 'PARENT' }
const TEACHER_ID = '11111111-1111-4111-8111-111111111111'
const FAMILY_ID = '22222222-2222-4222-8222-222222222222'
const PERSON_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({ schoolId: 'school-b', userId: 'admin-1' })
  findActiveByIdMock.mockResolvedValue({ id: 'school-b', name: 'Horizon', slug: 'horizon' })
  dbMock.user.findUnique.mockResolvedValue(null)
  dbMock.invitation.create.mockResolvedValue({ id: 'invitation-1' })
  dbMock.familyPerson.findFirst.mockResolvedValue({ personId: PERSON_ID })
  findMembershipMock.mockResolvedValue(null)
  sendInvitationEmailMock.mockResolvedValue('OK')
  dbMock.invitation.findFirst.mockResolvedValue(null)
  dbMock.teacher.findUnique.mockResolvedValue({
    id: TEACHER_ID,
    email: 'teacher@school.test',
    userId: null,
    isActive: true,
  })
})

describe('inviteUserAction', () => {
  describe('family scope', () => {
    it('resolves the parent of the family from the invited address when only the family is given', async () => {
      // Le formulaire des utilisateurs ne choisit que la famille : le parent est
      // retrouvé par l'adresse, jamais rattaché à l'aveugle.
      expect(await inviteUserAction({ ...INPUT, familyId: FAMILY_ID })).toBe('OK')

      expect(dbMock.familyPerson.findFirst).toHaveBeenCalledWith({
        where: {
          familyId: FAMILY_ID,
          schoolId: 'school-b',
          person: { email: { equals: 'parent@school.test', mode: 'insensitive' } },
        },
        select: { personId: true },
      })
      expect(dbMock.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ familyId: FAMILY_ID, personId: PERSON_ID }),
        })
      )
    })

    it('refuses a family whose parents do not carry the invited address', async () => {
      // Scénario de l'issue #429 : `{ role: PARENT, familyId, email: quelconque }` donnait
      // à un tiers l'accès aux enfants et aux paiements de la famille.
      dbMock.familyPerson.findFirst.mockResolvedValue(null)

      expect(
        await inviteUserAction({
          email: 'stranger@example.test',
          role: 'PARENT',
          familyId: FAMILY_ID,
        })
      ).toBe('invalidInput')
      expect(dbMock.invitation.create).not.toHaveBeenCalled()
      expect(sendInvitationEmailMock).not.toHaveBeenCalled()
    })

    it('requires the named person to belong to the family under the invited address', async () => {
      await inviteUserAction({ ...INPUT, familyId: FAMILY_ID, personId: PERSON_ID })

      expect(dbMock.familyPerson.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            familyId: FAMILY_ID,
            personId: PERSON_ID,
            person: { email: { equals: 'parent@school.test', mode: 'insensitive' } },
          }),
        })
      )
    })

    it('refuses a named person whose address is not the invited one', async () => {
      dbMock.familyPerson.findFirst.mockResolvedValue(null)

      expect(await inviteUserAction({ ...INPUT, familyId: FAMILY_ID, personId: PERSON_ID })).toBe(
        'invalidInput'
      )
      expect(dbMock.invitation.create).not.toHaveBeenCalled()
    })

    it('refuses a person without its family', async () => {
      expect(await inviteUserAction({ ...INPUT, personId: PERSON_ID })).toBe('invalidInput')
      expect(dbMock.familyPerson.findFirst).not.toHaveBeenCalled()
      expect(dbMock.invitation.create).not.toHaveBeenCalled()
    })

    it('refuses a family on a non-parent invitation', async () => {
      expect(await inviteUserAction({ ...INPUT, role: 'ADMIN', familyId: FAMILY_ID })).toBe(
        'invalidInput'
      )
      expect(dbMock.invitation.create).not.toHaveBeenCalled()
    })

    it('stores neither family nor person when no family is given', async () => {
      await inviteUserAction(INPUT)

      expect(dbMock.familyPerson.findFirst).not.toHaveBeenCalled()
      expect(dbMock.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ familyId: undefined, personId: undefined }),
        })
      )
    })
  })

  describe('teacher scope', () => {
    it('refuses an archived teacher profile', async () => {
      // `Teacher` échappe à l'extension soft-delete : le `findUnique` renvoie la fiche
      // archivée et l'action doit la refuser elle-même.
      dbMock.teacher.findUnique.mockResolvedValue({
        id: TEACHER_ID,
        email: 'teacher@school.test',
        userId: null,
        isActive: false,
      })

      expect(
        await inviteUserAction({
          email: 'teacher@school.test',
          role: 'TEACHER',
          teacherId: TEACHER_ID,
        })
      ).toBe('invalidInput')
      expect(dbMock.invitation.create).not.toHaveBeenCalled()
    })

    it('refuses a teacher profile already linked to an account', async () => {
      dbMock.teacher.findUnique.mockResolvedValue({
        id: TEACHER_ID,
        email: 'teacher@school.test',
        userId: 'user-9',
        isActive: true,
      })

      expect(
        await inviteUserAction({
          email: 'teacher@school.test',
          role: 'TEACHER',
          teacherId: TEACHER_ID,
        })
      ).toBe('invalidInput')
    })
  })

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

describe('inviteTeacherAction', () => {
  it('invites the address recorded on the teacher record', async () => {
    expect(await inviteTeacherAction({ teacherId: TEACHER_ID })).toBe('OK')
    expect(dbMock.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'teacher@school.test',
          role: 'TEACHER',
          teacherId: TEACHER_ID,
        }),
      })
    )
  })

  it('resends the open invitation instead of creating a second one', async () => {
    dbMock.invitation.findFirst.mockResolvedValue({
      id: 'invitation-1',
      email: 'teacher@school.test',
    })
    dbMock.invitation.findUnique.mockResolvedValue({
      id: 'invitation-1',
      email: 'teacher@school.test',
      locale: 'fr',
      usedAt: null,
    })

    expect(await inviteTeacherAction({ teacherId: TEACHER_ID })).toBe('OK')
    expect(dbMock.invitation.update).toHaveBeenCalled()
    expect(dbMock.invitation.create).not.toHaveBeenCalled()
  })

  it.each([
    [{ userId: 'user-1' }, 'alreadyLinked'],
    [{ email: null }, 'missingEmail'],
    [{ isActive: false }, 'notFound'],
  ])('refuses a teacher record %o with %s', async (override, expected) => {
    dbMock.teacher.findUnique.mockResolvedValue({
      id: TEACHER_ID,
      email: 'teacher@school.test',
      userId: null,
      isActive: true,
      ...override,
    })

    expect(await inviteTeacherAction({ teacherId: TEACHER_ID })).toBe(expected)
    expect(dbMock.invitation.create).not.toHaveBeenCalled()
  })
})
