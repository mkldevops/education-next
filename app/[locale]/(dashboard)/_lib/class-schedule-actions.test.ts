import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteClassScheduleSlot = vi.fn()
const revalidatePath = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('./auth-helper', () => ({
  requireSchoolAdmin: vi.fn().mockResolvedValue({ schoolId: 'school-1' }),
}))
vi.mock('@/use-cases/class-schedules/class-schedule-slot', () => ({
  createClassScheduleSlot: vi.fn(),
  updateClassScheduleSlot: vi.fn(),
  deleteClassScheduleSlot,
}))

const { deleteClassScheduleSlotAction } = await import('./class-schedule-actions')

describe('deleteClassScheduleSlotAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('revalidates the internal and public schedules after deletion', async () => {
    deleteClassScheduleSlot.mockResolvedValue('OK')

    await deleteClassScheduleSlotAction({ id: '9a7355a2-0670-45e2-bad8-56c47619f62a' })

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/planning')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('does not revalidate when deletion fails', async () => {
    deleteClassScheduleSlot.mockResolvedValue('notFound')

    await deleteClassScheduleSlotAction({ id: '9a7355a2-0670-45e2-bad8-56c47619f62a' })

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
