import { beforeEach, describe, expect, it, vi } from 'vitest'

const claim = vi.fn()
const findById = vi.fn()
const reclaim = vi.fn()
const release = vi.fn()
const transaction = vi.fn()
const createManyWithOverlapValidation = vi.fn()
const isClassScheduleEnabled = vi.fn()

const tx = {
  classPeriod: { findMany: vi.fn() },
  config: { findFirst: vi.fn() },
  mcpDraft: { updateMany: vi.fn() },
}

// Comme Prisma : le callback qui rend valide la transaction, celui qui lève l'annule.
let rolledBack = false
const prismaLikeTransaction = async (run: (client: typeof tx) => unknown) => {
  try {
    return await run(tx)
  } catch (error) {
    rolledBack = true
    throw error
  }
}

vi.mock('@/gateways/mcp-draft-gateway', () => ({
  mcpDraftGateway: { claim, findById, reclaim, release },
}))
vi.mock('@/lib/db', () => ({ db: { $transaction: transaction } }))
vi.mock('@/gateways/class-schedule-gateway', () => ({
  classScheduleGateway: { createManyWithOverlapValidation },
}))
vi.mock('@/use-cases/class-schedules/is-class-schedule-enabled', () => ({ isClassScheduleEnabled }))

const { commitClassSchedule } = await import('./commit-class-schedule')

const scope = {
  credentialId: 'key-1',
  credentialPrefix: 'edu_mcp_aaaa',
  owner: { kind: 'MCP_KEY' as const, keyId: 'key-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
  paymentsEnabled: true,
}

const fatima = { id: 'teacher-fatima', firstName: 'Fatima', lastName: 'Ali' }

const resolved = {
  tool: 'class_schedule',
  period: { id: 'period-1', name: '2026-2027' },
  slots: [
    {
      classPeriod: { id: 'class-c4', name: 'C4' },
      weekday: 6,
      startTime: '09:00',
      endTime: '12:00',
      description: null,
      teachers: [fatima],
    },
    {
      classPeriod: { id: 'class-c2', name: 'C2' },
      weekday: 7,
      startTime: '09:00',
      endTime: '12:00',
      description: 'Petits',
      teachers: [],
    },
  ],
}

const input = { draftId: '33333333-3333-4333-8333-333333333333', checksum: 'abcdef012345' }

const draft = (overrides: Record<string, unknown> = {}) => ({
  ownerKind: 'MCP_KEY',
  keyId: 'key-1',
  userId: null,
  tool: 'class_schedule',
  checksum: input.checksum,
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 60_000),
  resolved,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  isClassScheduleEnabled.mockResolvedValue(true)
  claim.mockResolvedValue({ count: 1 })
  findById.mockResolvedValue(draft())
  rolledBack = false
  transaction.mockImplementation(prismaLikeTransaction)
  tx.classPeriod.findMany.mockResolvedValue([
    { id: 'class-c4', teachers: [{ teacherId: 'teacher-fatima' }] },
    { id: 'class-c2', teachers: [] },
  ])
  tx.config.findFirst.mockResolvedValue(null)
  tx.mcpDraft.updateMany.mockResolvedValue({ count: 1 })
  createManyWithOverlapValidation.mockResolvedValue({
    status: 'OK',
    slots: [
      { id: 'slot-1', teacherOverlapIds: ['slot-old'] },
      { id: 'slot-2', teacherOverlapIds: [] },
    ],
  })
})

describe('commitClassSchedule', () => {
  it('writes the whole batch through the gateway inside the draft transaction', async () => {
    const result = await commitClassSchedule(scope, input)

    expect(createManyWithOverlapValidation).toHaveBeenCalledWith(
      tx,
      'school-1',
      [
        {
          classPeriodId: 'class-c4',
          weekday: 6,
          startTime: '09:00',
          endTime: '12:00',
          description: null,
          teacherIds: ['teacher-fatima'],
        },
        {
          classPeriodId: 'class-c2',
          weekday: 7,
          startTime: '09:00',
          endTime: '12:00',
          description: 'Petits',
          teacherIds: [],
        },
      ],
      true
    )
    expect(result).toEqual({
      periodId: 'period-1',
      slots: [
        { id: 'slot-1', warnings: [{ type: 'teacherOverlap', slotIds: ['slot-old'] }] },
        { id: 'slot-2', warnings: [] },
      ],
    })
    expect(tx.mcpDraft.updateMany).toHaveBeenCalledWith({
      where: { id: input.draftId, schoolId: 'school-1' },
      data: { result },
    })
  })

  it('rereads the classes of the key school in the right period before writing', async () => {
    await commitClassSchedule(scope, input)

    expect(tx.classPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId: 'school-1',
          id: { in: ['class-c4', 'class-c2'] },
          periodId: 'period-1',
          isActive: true,
        },
      })
    )
    expect(tx.classPeriod.findMany.mock.invocationCallOrder[0]).toBeLessThan(
      createManyWithOverlapValidation.mock.invocationCallOrder[0]
    )
  })

  it('refuses without claiming when planning is disabled, even a draft prepared before', async () => {
    isClassScheduleEnabled.mockResolvedValue(false)

    expect(await commitClassSchedule(scope, input)).toBe('notConfigured')
    expect(claim).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('refuses the whole batch when a class was archived since the preview', async () => {
    tx.classPeriod.findMany.mockResolvedValue([{ id: 'class-c4', teachers: [] }])

    expect(await commitClassSchedule(scope, input)).toBe('notFound')
    expect(rolledBack).toBe(true)
    expect(createManyWithOverlapValidation).not.toHaveBeenCalled()
    expect(tx.mcpDraft.updateMany).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('refuses the whole batch when a teacher is no longer assigned to the class', async () => {
    tx.classPeriod.findMany.mockResolvedValue([
      { id: 'class-c4', teachers: [] },
      { id: 'class-c2', teachers: [] },
    ])

    expect(await commitClassSchedule(scope, input)).toBe('teacherNotFound')
    expect(createManyWithOverlapValidation).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('rolls the transaction back when a later slot overlaps at commit time, so the earlier ones vanish too', async () => {
    createManyWithOverlapValidation.mockResolvedValue({ status: 'classOverlap', index: 1 })

    expect(await commitClassSchedule(scope, input)).toBe('classOverlap')
    expect(rolledBack).toBe(true)
    expect(tx.mcpDraft.updateMany).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('rolls back a teacher overlap the school forbids as well', async () => {
    createManyWithOverlapValidation.mockResolvedValue({ status: 'teacherOverlap', index: 0 })

    expect(await commitClassSchedule(scope, input)).toBe('teacherOverlap')
    expect(rolledBack).toBe(true)
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('does not roll back a planning that went through', async () => {
    await commitClassSchedule(scope, input)

    expect(rolledBack).toBe(false)
    expect(release).not.toHaveBeenCalled()
  })

  it('sizes the transaction timeout to the batch', async () => {
    await commitClassSchedule(scope, input)

    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 5_000 + 2 * 250,
      maxWait: 5_000,
    })
  })

  it('reads the teacher overlap rule fresh, inside the transaction', async () => {
    tx.config.findFirst.mockResolvedValue({ value: 'false' })

    await commitClassSchedule(scope, input)

    expect(tx.config.findFirst).toHaveBeenCalledWith({
      where: { schoolId: 'school-1', name: 'class_schedule_teacher_overlap_allowed' },
      select: { value: true },
    })
    expect(createManyWithOverlapValidation.mock.calls[0][3]).toBe(false)
  })

  it('returns the recorded result on a replay instead of writing the planning twice', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue(
      draft({ status: 'COMMITTED', result: { periodId: 'period-1', slots: [{ id: 'slot-1' }] } })
    )

    expect(await commitClassSchedule(scope, input)).toEqual({
      periodId: 'period-1',
      slots: [{ id: 'slot-1' }],
    })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('refuses a checksum that does not match the draft', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue(draft({ checksum: 'abcdef012346' }))

    expect(await commitClassSchedule(scope, input)).toBe('checksumMismatch')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('refuses an enrolment draft presented to the planning commit', async () => {
    claim.mockResolvedValue({ count: 0 })
    findById.mockResolvedValue(draft({ tool: 'enroll_family' }))

    expect(await commitClassSchedule(scope, input)).toBe('draftNotFound')
  })

  it('releases a claimed draft whose plan no longer parses', async () => {
    findById.mockResolvedValue(draft({ resolved: { period: { id: 'p' }, slots: [] } }))

    expect(await commitClassSchedule(scope, input)).toBe('validationError')
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('gives the lock back when the transaction blows up', async () => {
    transaction.mockRejectedValue(new Error('connection lost'))

    await expect(commitClassSchedule(scope, input)).rejects.toThrow('connection lost')
    expect(release).toHaveBeenCalledWith('school-1', input.draftId)
  })

  it('rejects a malformed checksum without touching the lock', async () => {
    expect(await commitClassSchedule(scope, { draftId: input.draftId, checksum: 'short' })).toBe(
      'validationError'
    )
    expect(claim).not.toHaveBeenCalled()
  })
})
