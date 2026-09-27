// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { classScheduleGateway } from '@/gateways/class-schedule-gateway'
import type { PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient } from '@/lib/db'
import { commitInTransaction } from '@/use-cases/mcp/claim-draft'

const databaseUrl = process.env.DATABASE_URL
let raw: PrismaClient
let schoolId: string
let classIds: [string, string]
let teacherId: string

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('classScheduleGateway concurrency', () => {
  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    const suffix = Date.now().toString(36)
    const school = await raw.school.create({
      data: { name: `schedule ${suffix}`, slug: `schedule-${suffix}` },
    })
    schoolId = school.id
    const level = await raw.level.create({ data: { schoolId, name: `level ${suffix}` } })
    const period = await raw.period.create({
      data: {
        schoolId,
        name: `period ${suffix}`,
        startAt: new Date('2026-09-01'),
        endAt: new Date('2027-06-30'),
      },
    })
    const classes = await Promise.all(
      ['A', 'B'].map((name) =>
        raw.classPeriod.create({
          data: {
            schoolId,
            name: `class ${name}`,
            capacity: 20,
            levelId: level.id,
            periodId: period.id,
          },
        })
      )
    )
    classIds = [classes[0].id, classes[1].id]
    const teacher = await raw.teacher.create({
      data: { schoolId, firstName: 'Amina', lastName: 'Concurrent' },
    })
    teacherId = teacher.id
    await raw.classPeriodTeacher.createMany({
      data: classIds.map((classPeriodId) => ({ schoolId, classPeriodId, teacherId })),
    })
  })

  beforeEach(async () => {
    await raw.classScheduleSlotTeacher.deleteMany({ where: { schoolId } })
    await raw.classScheduleSlot.deleteMany({ where: { schoolId } })
  })

  afterAll(async () => {
    if (!raw) return
    await raw.classScheduleSlotTeacher.deleteMany({ where: { schoolId } })
    await raw.classScheduleSlot.deleteMany({ where: { schoolId } })
    await raw.classPeriodTeacher.deleteMany({ where: { schoolId } })
    await raw.teacher.deleteMany({ where: { schoolId } })
    await raw.classPeriod.deleteMany({ where: { schoolId } })
    await raw.period.deleteMany({ where: { schoolId } })
    await raw.level.deleteMany({ where: { schoolId } })
    await raw.school.delete({ where: { id: schoolId } })
    await raw.$disconnect()
  })

  it('serializes concurrent overlaps for the same class', async () => {
    const results = await Promise.all([
      classScheduleGateway.saveWithOverlapValidation(
        schoolId,
        {
          classPeriodId: classIds[0],
          weekday: 1,
          startTime: '09:00',
          endTime: '11:00',
          teacherIds: [],
        },
        true
      ),
      classScheduleGateway.saveWithOverlapValidation(
        schoolId,
        {
          classPeriodId: classIds[0],
          weekday: 1,
          startTime: '10:00',
          endTime: '12:00',
          teacherIds: [],
        },
        true
      ),
    ])

    expect(results.map((result) => result.status).sort()).toEqual(['OK', 'classOverlap'])
  })

  it('serializes concurrent teacher overlaps when they are forbidden', async () => {
    const results = await Promise.all(
      classIds.map((classPeriodId) =>
        classScheduleGateway.saveWithOverlapValidation(
          schoolId,
          {
            classPeriodId,
            weekday: 2,
            startTime: '09:00',
            endTime: '11:00',
            teacherIds: [teacherId],
          },
          false
        )
      )
    )

    expect(results.map((result) => result.status).sort()).toEqual(['OK', 'teacherOverlap'])
  })

  it('leaves no slot of a batch behind when a later one is refused at commit time', async () => {
    const draft = await raw.mcpDraft.create({
      data: {
        schoolId,
        ownerKind: 'MCP_KEY',
        keyId: 'key-rollback',
        tool: 'class_schedule',
        checksum: 'abcdef012345',
        resolved: {},
        status: 'COMMITTED',
        committedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    const taken = await classScheduleGateway.saveWithOverlapValidation(
      schoolId,
      {
        classPeriodId: classIds[0],
        weekday: 3,
        startTime: '09:00',
        endTime: '11:00',
        teacherIds: [],
      },
      true
    )
    expect(taken.status).toBe('OK')

    const result = await commitInTransaction(schoolId, draft.id, async (tx) => {
      const saved = await classScheduleGateway.createManyWithOverlapValidation(
        tx,
        schoolId,
        [
          {
            classPeriodId: classIds[1],
            weekday: 3,
            startTime: '09:00',
            endTime: '11:00',
            teacherIds: [],
          },
          {
            classPeriodId: classIds[0],
            weekday: 3,
            startTime: '10:00',
            endTime: '12:00',
            teacherIds: [],
          },
        ],
        true
      )
      return saved.status === 'OK' ? saved : saved.status
    })

    expect(result).toBe('classOverlap')
    await expect(
      raw.classScheduleSlot.count({ where: { schoolId, classPeriodId: classIds[1] } })
    ).resolves.toBe(0)
    await expect(
      raw.mcpDraft.findUniqueOrThrow({ where: { id: draft.id }, select: { status: true } })
    ).resolves.toEqual({ status: 'PENDING' })
  })
})
