import { beforeEach, describe, expect, it, vi } from 'vitest'

const listClassScheduleSlots = vi.fn()
const findById = vi.fn()
const isClassScheduleEnabled = vi.fn()
const createClassScheduleSlot = vi.fn()
const updateClassScheduleSlot = vi.fn()
const deleteClassScheduleSlot = vi.fn()

vi.mock('@/gateways/mcp-read-gateway', () => ({
  mcpReadGateway: { listClassScheduleSlots },
}))
vi.mock('@/gateways/class-schedule-gateway', () => ({ classScheduleGateway: { findById } }))
vi.mock('@/use-cases/class-schedules/is-class-schedule-enabled', () => ({ isClassScheduleEnabled }))
vi.mock('@/use-cases/class-schedules/class-schedule-slot', () => ({
  createClassScheduleSlot,
  updateClassScheduleSlot,
  deleteClassScheduleSlot,
}))

const {
  listClassScheduleSlotsFromMcp,
  createClassScheduleSlotFromMcp,
  updateClassScheduleSlotFromMcp,
  deleteClassScheduleSlotFromMcp,
} = await import('./class-schedule')

const scope = { schoolId: 'key-school' }
const periodId = '00000000-0000-4000-8000-000000000001'
const classPeriodId = '00000000-0000-4000-8000-000000000002'
const slotId = '00000000-0000-4000-8000-000000000003'
const slot = {
  classPeriodId,
  weekday: 6,
  startTime: '09:00',
  endTime: '12:00',
  description: 'Grands garçons et hommes',
  teacherIds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  isClassScheduleEnabled.mockResolvedValue(true)
})

describe('MCP class schedule adapter', () => {
  it('lists the key school only when planning is enabled', async () => {
    listClassScheduleSlots.mockResolvedValue([{ id: slotId }])
    expect(await listClassScheduleSlotsFromMcp(scope, { periodId })).toEqual([{ id: slotId }])
    expect(listClassScheduleSlots).toHaveBeenCalledWith('key-school', periodId)

    isClassScheduleEnabled.mockResolvedValue(false)
    expect(await listClassScheduleSlotsFromMcp(scope, { periodId })).toBe('notConfigured')
    expect(listClassScheduleSlots).toHaveBeenCalledTimes(1)
  })

  it('creates with school from the key, returning only the slot id and warnings', async () => {
    createClassScheduleSlot.mockResolvedValue({
      slot: { id: slotId, schoolId: 'key-school', secretFutureField: 'private' },
      warnings: [],
    })
    expect(await createClassScheduleSlotFromMcp(scope, slot)).toEqual({ id: slotId, warnings: [] })
    expect(createClassScheduleSlot).toHaveBeenCalledWith({ ...slot, schoolId: 'key-school' })
  })

  it('updates and deletes through the existing use cases', async () => {
    updateClassScheduleSlot.mockResolvedValue({ slot: { id: slotId }, warnings: [] })
    deleteClassScheduleSlot.mockResolvedValue('OK')
    findById.mockResolvedValue({ id: slotId, classPeriodId })
    const { classPeriodId: _classPeriodId, ...mutableSlot } = slot
    expect(await updateClassScheduleSlotFromMcp(scope, { ...mutableSlot, id: slotId })).toEqual({
      id: slotId,
      warnings: [],
    })
    expect(findById).toHaveBeenCalledWith('key-school', slotId)
    expect(updateClassScheduleSlot).toHaveBeenCalledWith({
      ...slot,
      id: slotId,
      schoolId: 'key-school',
    })
    expect(await deleteClassScheduleSlotFromMcp(scope, { id: slotId })).toEqual({ deleted: true })
    expect(deleteClassScheduleSlot).toHaveBeenCalledWith({ id: slotId, schoolId: 'key-school' })
  })

  it('does not update an unknown slot', async () => {
    findById.mockResolvedValue(null)
    const { classPeriodId: _classPeriodId, ...mutableSlot } = slot
    expect(await updateClassScheduleSlotFromMcp(scope, { ...mutableSlot, id: slotId })).toBe(
      'notFound'
    )
    expect(updateClassScheduleSlot).not.toHaveBeenCalled()
  })

  it('does not read a slot when planning is disabled', async () => {
    isClassScheduleEnabled.mockResolvedValue(false)
    const { classPeriodId: _classPeriodId, ...mutableSlot } = slot
    expect(await updateClassScheduleSlotFromMcp(scope, { ...mutableSlot, id: slotId })).toBe(
      'notConfigured'
    )
    expect(findById).not.toHaveBeenCalled()
  })

  it('rejects malformed times before calling a writer', async () => {
    expect(await createClassScheduleSlotFromMcp(scope, { ...slot, startTime: '9h' })).toBe(
      'validationError'
    )
    expect(createClassScheduleSlot).not.toHaveBeenCalled()
  })
})
