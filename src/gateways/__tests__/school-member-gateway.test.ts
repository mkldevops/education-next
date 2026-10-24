// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  grantMemberRole,
  schoolMemberGateway,
  withdrawTeacherRole,
} from '@/gateways/school-member-gateway'
import type { PrismaClient, SchoolRole } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'

const databaseUrl = process.env.DATABASE_URL
let raw: PrismaClient
let schoolId: string
let adminId: string
let memberId: string
let familyId: string
let teacherId: string

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('schoolMemberGateway roles', () => {
  const membership = () =>
    raw.schoolMember.findUnique({
      where: { userId_schoolId: { userId: memberId, schoolId } },
      select: { roles: true },
    })

  const seedMember = async (roles: SchoolRole[]) => {
    await raw.schoolMember.create({ data: { userId: memberId, schoolId, roles } })
    if (roles.includes('PARENT')) {
      await raw.userFamily.create({ data: { userId: memberId, familyId, schoolId } })
    }
    if (roles.includes('TEACHER')) {
      await raw.teacher.update({ where: { id: teacherId }, data: { userId: memberId } })
    }
  }

  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    const suffix = Date.now().toString(36)
    const school = await raw.school.create({
      data: { name: `members ${suffix}`, slug: `members-${suffix}` },
    })
    schoolId = school.id
    const [admin, member] = await Promise.all([
      raw.user.create({ data: { email: `admin-${suffix}@members.test`, name: 'admin' } }),
      raw.user.create({ data: { email: `member-${suffix}@members.test`, name: 'member' } }),
    ])
    adminId = admin.id
    memberId = member.id
    await raw.schoolMember.create({ data: { userId: adminId, schoolId, roles: ['ADMIN'] } })
    const family = await raw.family.create({
      data: { schoolId, name: `fam ${suffix}`, createdById: adminId },
    })
    familyId = family.id
    const teacher = await raw.teacher.create({
      data: { schoolId, firstName: 'Amina', lastName: 'Roles' },
    })
    teacherId = teacher.id
  })

  beforeEach(async () => {
    await raw.userFamily.deleteMany({ where: { schoolId, userId: memberId } })
    await raw.teacher.update({ where: { id: teacherId }, data: { userId: null } })
    await raw.schoolMember.deleteMany({ where: { schoolId, userId: memberId } })
    await raw.schoolMember.update({
      where: { userId_schoolId: { userId: adminId, schoolId } },
      data: { roles: ['ADMIN'] },
    })
  })

  afterAll(async () => {
    if (!raw) return
    await raw.userFamily.deleteMany({ where: { schoolId } })
    await raw.teacher.deleteMany({ where: { schoolId } })
    await raw.family.deleteMany({ where: { schoolId } })
    await raw.schoolMember.deleteMany({ where: { schoolId } })
    await raw.school.delete({ where: { id: schoolId } })
    await raw.user.deleteMany({ where: { id: { in: [adminId, memberId] } } })
    await raw.$disconnect()
  })

  describe('grantMemberRole', () => {
    it('creates the membership of a newcomer', async () => {
      await raw.$transaction((tx) => grantMemberRole(tx, memberId, schoolId, 'PARENT'))

      expect(await membership()).toEqual({ roles: ['PARENT'] })
    })

    it('adds a role to an existing member in the stored order', async () => {
      await seedMember(['PARENT'])

      await raw.$transaction((tx) => grantMemberRole(tx, memberId, schoolId, 'ADMIN'))

      expect(await membership()).toEqual({ roles: ['ADMIN', 'PARENT'] })
    })

    it('never duplicates a role already held', async () => {
      await seedMember(['TEACHER', 'PARENT'])

      await raw.$transaction((tx) => grantMemberRole(tx, memberId, schoolId, 'TEACHER'))

      expect(await membership()).toEqual({ roles: ['TEACHER', 'PARENT'] })
    })
  })

  describe('withdrawTeacherRole', () => {
    it('keeps the other roles and unlinks the teacher profile', async () => {
      await seedMember(['TEACHER', 'PARENT'])

      await raw.$transaction((tx) => withdrawTeacherRole(tx, memberId, schoolId))

      expect(await membership()).toEqual({ roles: ['PARENT'] })
      expect(await raw.teacher.findUnique({ where: { id: teacherId } })).toMatchObject({
        userId: null,
      })
      expect(await raw.userFamily.count({ where: { schoolId, userId: memberId } })).toBe(1)
    })
  })

  describe('setAssignableRoles', () => {
    it('keeps the teacher role, which follows the teacher profile', async () => {
      await seedMember(['TEACHER', 'PARENT'])

      expect(await schoolMemberGateway.setAssignableRoles(memberId, schoolId, ['ADMIN'])).toBe('OK')
      expect(await membership()).toEqual({ roles: ['ADMIN', 'TEACHER'] })
      expect(await raw.teacher.findUnique({ where: { id: teacherId } })).toMatchObject({
        userId: memberId,
      })
    })

    it('deletes the family links of a member losing the parent role', async () => {
      await seedMember(['ADMIN', 'PARENT'])

      expect(await schoolMemberGateway.setAssignableRoles(memberId, schoolId, ['ADMIN'])).toBe('OK')
      expect(await raw.userFamily.count({ where: { schoolId, userId: memberId } })).toBe(0)
    })

    it('refuses an empty set', async () => {
      await seedMember(['PARENT'])

      expect(await schoolMemberGateway.setAssignableRoles(memberId, schoolId, [])).toBe('noRole')
      expect(await membership()).toEqual({ roles: ['PARENT'] })
    })

    it('refuses to remove the admin role of the last administrator', async () => {
      await raw.schoolMember.update({
        where: { userId_schoolId: { userId: adminId, schoolId } },
        data: { roles: ['ADMIN', 'PARENT'] },
      })

      expect(await schoolMemberGateway.setAssignableRoles(adminId, schoolId, ['PARENT'])).toBe(
        'lastAdmin'
      )
      expect(
        await raw.schoolMember.findUnique({
          where: { userId_schoolId: { userId: adminId, schoolId } },
          select: { roles: true },
        })
      ).toEqual({ roles: ['ADMIN', 'PARENT'] })
    })

    it('answers notFound for a non-member', async () => {
      expect(await schoolMemberGateway.setAssignableRoles(memberId, schoolId, ['PARENT'])).toBe(
        'notFound'
      )
    })
  })

  describe('removeMembership', () => {
    it('deletes the membership with its family and teacher links', async () => {
      await seedMember(['TEACHER', 'PARENT'])

      expect(await schoolMemberGateway.removeMembership(memberId, schoolId)).toBe('OK')
      expect(await membership()).toBeNull()
      expect(await raw.userFamily.count({ where: { schoolId, userId: memberId } })).toBe(0)
      expect(await raw.teacher.findUnique({ where: { id: teacherId } })).toMatchObject({
        userId: null,
      })
    })

    it('refuses to remove the last administrator', async () => {
      expect(await schoolMemberGateway.removeMembership(adminId, schoolId)).toBe('lastAdmin')
    })
  })
})
