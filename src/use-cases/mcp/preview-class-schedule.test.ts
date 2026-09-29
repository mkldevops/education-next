import { beforeEach, describe, expect, it, vi } from 'vitest'

const listPeriods = vi.fn()
const listClassPeriods = vi.fn()
const listTeachers = vi.fn()
const listClassScheduleSlots = vi.fn()
const listByTeachers = vi.fn()
const getConfig = vi.fn()
const isClassScheduleEnabled = vi.fn()
const createDraft = vi.fn()

vi.mock('@/gateways/mcp-read-gateway', () => ({
  mcpReadGateway: { listPeriods, listClassPeriods, listTeachers, listClassScheduleSlots },
}))
vi.mock('@/gateways/class-schedule-gateway', () => ({ classScheduleGateway: { listByTeachers } }))
vi.mock('@/gateways/config-gateway', () => ({ configGateway: { get: getConfig } }))
vi.mock('@/use-cases/class-schedules/is-class-schedule-enabled', () => ({ isClassScheduleEnabled }))
vi.mock('@/gateways/mcp-draft-gateway', () => ({ mcpDraftGateway: { create: createDraft } }))

const { previewClassSchedule } = await import('./preview-class-schedule')

const scope = {
  credentialId: 'key-1',
  credentialPrefix: 'edu_mcp_aaaa',
  owner: { kind: 'MCP_KEY' as const, keyId: 'key-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false as const,
  paymentsEnabled: true,
}

const periodId = '00000000-0000-4000-8000-000000000001'
const otherPeriodId = '00000000-0000-4000-8000-000000000009'
const fatima = { id: 'teacher-fatima', firstName: 'Fatima', lastName: 'Ali' }
const omar = { id: 'teacher-omar', firstName: 'Omar', lastName: 'Ben' }
const sara = { id: 'teacher-sara', firstName: 'Sara', lastName: 'Ndiaye' }
const c4 = {
  id: 'class-c4',
  name: 'C4',
  period: { id: periodId, name: '2026-2027' },
  teachers: [{ teacher: fatima }, { teacher: omar }],
}
const c2 = { id: 'class-c2', name: 'C2', period: { id: periodId, name: '2026-2027' }, teachers: [] }
const lastYear = {
  id: 'class-old',
  name: 'C4',
  period: { id: otherPeriodId, name: '2025-2026' },
  teachers: [{ teacher: fatima }],
}

const input = {
  periodId,
  slots: [
    { className: 'C4', weekday: 6, startTime: '09:00', endTime: '12:00', teacherNames: ['Fatima'] },
    { className: 'C2', weekday: 6, startTime: '09:00', endTime: '12:00', description: 'Petits' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  isClassScheduleEnabled.mockResolvedValue(true)
  listPeriods.mockResolvedValue([
    { id: periodId, name: '2026-2027' },
    { id: otherPeriodId, name: '2025-2026' },
  ])
  listClassPeriods.mockResolvedValue([c4, c2, lastYear])
  listTeachers.mockResolvedValue([fatima, omar, sara])
  listClassScheduleSlots.mockResolvedValue([])
  listByTeachers.mockResolvedValue([])
  getConfig.mockResolvedValue(null)
  createDraft.mockResolvedValue({ id: 'draft-7' })
})

function assertPreview<T>(result: T): asserts result is Exclude<T, string> {
  if (typeof result === 'string') throw new Error(`expected a preview, got ${result}`)
}

describe('previewClassSchedule', () => {
  it('resolves labels against the key school and saves the plan as a class_schedule draft', async () => {
    const result = await previewClassSchedule(scope, input)
    assertPreview(result)

    expect(result.blockers).toEqual([])
    expect(result.draftId).toBe('draft-7')
    expect(result.plan).toEqual({
      tool: 'class_schedule',
      period: { id: periodId, name: '2026-2027' },
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
          weekday: 6,
          startTime: '09:00',
          endTime: '12:00',
          description: 'Petits',
          teachers: [],
        },
      ],
    })
    for (const read of [listPeriods, listClassPeriods, listTeachers]) {
      expect(read).toHaveBeenCalledWith('school-1')
    }
    expect(listClassScheduleSlots).toHaveBeenCalledWith('school-1', periodId)
    expect(listByTeachers).toHaveBeenCalledWith('school-1', ['teacher-fatima'])
    expect(createDraft).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({ tool: 'class_schedule', owner: scope.owner })
    )
  })

  it('refuses before reading anything when planning is disabled', async () => {
    isClassScheduleEnabled.mockResolvedValue(false)

    expect(await previewClassSchedule(scope, input)).toBe('notConfigured')
    expect(listPeriods).not.toHaveBeenCalled()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('blocks a period the key school does not have', async () => {
    const result = await previewClassSchedule(scope, {
      ...input,
      periodId: '00000000-0000-4000-8000-0000000000ff',
    })
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'periodId', value: '00000000-0000-4000-8000-0000000000ff', reason: 'notFound' },
    ])
    expect(listClassPeriods).not.toHaveBeenCalled()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('only matches classes of the requested period, and names the ambiguous line with its candidates', async () => {
    const result = await previewClassSchedule(scope, {
      periodId,
      slots: [
        { className: 'F', weekday: 6, startTime: '09:00', endTime: '12:00' },
        { className: 'C', weekday: 6, startTime: '09:00', endTime: '12:00' },
      ],
    })
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'slots.0.className', value: 'F', reason: 'notFound' },
      { field: 'slots.1.className', value: 'C', reason: 'ambiguousClass' },
    ])
    expect(result.matches.classes).toEqual([
      { id: 'class-c4', name: 'C4' },
      { id: 'class-c2', name: 'C2' },
    ])
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('tells an unassigned teacher from an unknown one and an ambiguous one', async () => {
    listClassPeriods.mockResolvedValue([
      { ...c4, teachers: [{ teacher: fatima }, { teacher: { ...omar, firstName: 'Fatou' } }] },
    ])

    const result = await previewClassSchedule(scope, {
      periodId,
      slots: [
        {
          className: 'C4',
          weekday: 6,
          startTime: '09:00',
          endTime: '12:00',
          teacherNames: ['Sara', 'Inconnu', 'Fat', 'Ali Fatima'],
        },
      ],
    })
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'slots.0.teacherNames.0', value: 'Sara', reason: 'teacherNotAssigned' },
      { field: 'slots.0.teacherNames.1', value: 'Inconnu', reason: 'notFound' },
      { field: 'slots.0.teacherNames.2', value: 'Fat', reason: 'ambiguousTeacher' },
    ])
    expect(result.matches.teachers).toEqual([fatima, { ...omar, firstName: 'Fatou' }])
  })

  it('blocks a slot ending before it starts on its own line', async () => {
    const result = await previewClassSchedule(scope, {
      periodId,
      slots: [{ className: 'C4', weekday: 6, startTime: '12:00', endTime: '09:00' }],
    })
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'slots.0.endTime', value: '09:00', reason: 'invalidTimeRange' },
    ])
  })

  it('blocks a duplicate and an overlap inside the batch, pointing at the earlier line', async () => {
    const result = await previewClassSchedule(scope, {
      periodId,
      slots: [
        { className: 'C4', weekday: 6, startTime: '09:00', endTime: '12:00' },
        { className: 'C4', weekday: 6, startTime: '09:00', endTime: '12:00' },
        { className: 'C4', weekday: 6, startTime: '11:00', endTime: '13:00' },
        { className: 'C4', weekday: 6, startTime: '12:00', endTime: '14:00' },
      ],
    })
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'slots.1.startTime', value: 'slots.0', reason: 'duplicateSlot' },
      { field: 'slots.2.startTime', value: 'slots.0', reason: 'classOverlap' },
      { field: 'slots.2.startTime', value: 'slots.1', reason: 'classOverlap' },
      { field: 'slots.3.startTime', value: 'slots.2', reason: 'classOverlap' },
    ])
  })

  it('blocks an identical or overlapping slot already in the period, and returns it', async () => {
    listClassScheduleSlots.mockResolvedValue([
      {
        id: 'slot-existing',
        weekday: 6,
        startTime: '09:00',
        endTime: '12:00',
        description: null,
        classPeriod: { id: 'class-c4', name: 'C4' },
        teachers: [],
      },
      {
        id: 'slot-other-class',
        weekday: 6,
        startTime: '10:00',
        endTime: '11:00',
        description: null,
        classPeriod: { id: 'class-c2', name: 'C2' },
        teachers: [],
      },
    ])

    const result = await previewClassSchedule(scope, input)
    assertPreview(result)

    expect(result.blockers).toEqual([
      { field: 'slots.0.startTime', value: 'slot-existing', reason: 'alreadyExists' },
      { field: 'slots.1.startTime', value: 'slot-other-class', reason: 'classOverlap' },
    ])
    expect(result.matches.existingSlots).toEqual([
      {
        id: 'slot-existing',
        classPeriodId: 'class-c4',
        weekday: 6,
        startTime: '09:00',
        endTime: '12:00',
      },
      {
        id: 'slot-other-class',
        classPeriodId: 'class-c2',
        weekday: 6,
        startTime: '10:00',
        endTime: '11:00',
      },
    ])
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('warns when a teacher is booked twice, in the batch or by another period of the school', async () => {
    listByTeachers.mockResolvedValue([
      {
        id: 'slot-last-year',
        classPeriodId: 'class-old',
        weekday: 6,
        startTime: '08:00',
        endTime: '10:00',
        teachers: [{ teacherId: 'teacher-fatima' }],
      },
    ])
    const doubleBooked = {
      periodId,
      slots: [
        {
          className: 'C4',
          weekday: 6,
          startTime: '09:00',
          endTime: '12:00',
          teacherNames: ['Ali'],
        },
        { className: 'C2', weekday: 6, startTime: '11:00', endTime: '13:00', teacherNames: [] },
      ],
    }
    listClassPeriods.mockResolvedValue([c4, { ...c2, teachers: [{ teacher: fatima }] }, lastYear])
    doubleBooked.slots[1].teacherNames = ['Fatima Ali']

    const result = await previewClassSchedule(scope, doubleBooked)
    assertPreview(result)

    expect(result.blockers).toEqual([])
    expect(result.warnings).toEqual([
      { field: 'slots.0.teacherNames', value: 'slot-last-year', reason: 'teacherOverlap' },
      { field: 'slots.1.teacherNames', value: 'slots.0', reason: 'teacherOverlap' },
    ])
    expect(result.matches.existingSlots).toEqual([
      {
        id: 'slot-last-year',
        classPeriodId: 'class-old',
        weekday: 6,
        startTime: '08:00',
        endTime: '10:00',
      },
    ])
    expect(result.draftId).toBe('draft-7')
  })

  it('turns teacher overlaps into blockers when the school forbids them', async () => {
    getConfig.mockResolvedValue({ value: 'false' })
    listClassPeriods.mockResolvedValue([c4, { ...c2, teachers: [{ teacher: fatima }] }])

    const result = await previewClassSchedule(scope, {
      periodId,
      slots: [
        {
          className: 'C4',
          weekday: 6,
          startTime: '09:00',
          endTime: '12:00',
          teacherNames: ['Fatima'],
        },
        {
          className: 'C2',
          weekday: 6,
          startTime: '11:00',
          endTime: '13:00',
          teacherNames: ['Fatima'],
        },
      ],
    })
    assertPreview(result)

    expect(getConfig).toHaveBeenCalledWith('school-1', 'class_schedule_teacher_overlap_allowed')
    expect(result.blockers).toEqual([
      { field: 'slots.1.teacherNames', value: 'slots.0', reason: 'teacherOverlap' },
    ])
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('rejects an empty batch and a malformed time without reading', async () => {
    expect(await previewClassSchedule(scope, { periodId, slots: [] })).toBe('validationError')
    expect(
      await previewClassSchedule(scope, {
        periodId,
        slots: [{ className: 'C4', weekday: 6, startTime: '9h', endTime: '12:00' }],
      })
    ).toBe('validationError')
    expect(listPeriods).not.toHaveBeenCalled()
  })
})
