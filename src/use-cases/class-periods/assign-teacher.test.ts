import { describe, expect, it, vi } from 'vitest'
import { assignClassPeriodTeacher } from './assign-teacher'

const schoolId = 'school-1'
const id = '123e4567-e89b-12d3-a456-426614174001'
const teacherId = '123e4567-e89b-12d3-a456-426614174010'

function gateways({
  classPeriod = { id } as object | null,
  teachers = [{ id: teacherId }],
  created = true,
} = {}) {
  return {
    classPeriodGw: {
      findById: vi.fn().mockResolvedValue(classPeriod),
      assignTeacher: vi.fn().mockResolvedValue(created),
    },
    teacherGw: { findByIds: vi.fn().mockResolvedValue(teachers) },
  }
}

type ClassPeriodGw = Parameters<typeof assignClassPeriodTeacher>[1]
type TeacherGw = Parameters<typeof assignClassPeriodTeacher>[2]

function run(gw: ReturnType<typeof gateways>, input = { schoolId, id, teacherId }) {
  return assignClassPeriodTeacher(
    input,
    gw.classPeriodGw as unknown as ClassPeriodGw,
    gw.teacherGw as unknown as TeacherGw
  )
}

describe('assignClassPeriodTeacher', () => {
  it('adds the teacher to the class of the school', async () => {
    const gw = gateways()

    const result = await run(gw)

    expect(gw.teacherGw.findByIds).toHaveBeenCalledWith(schoolId, [teacherId])
    expect(gw.classPeriodGw.assignTeacher).toHaveBeenCalledWith(schoolId, id, teacherId)
    expect(result).toEqual({ classPeriodId: id, teacherId, alreadyAssigned: false })
  })

  it('reports an existing assignment instead of failing', async () => {
    const result = await run(gateways({ created: false }))

    expect(result).toEqual({ classPeriodId: id, teacherId, alreadyAssigned: true })
  })

  it('refuses an unknown class without writing', async () => {
    const gw = gateways({ classPeriod: null })

    expect(await run(gw)).toBe('notFound')
    expect(gw.classPeriodGw.assignTeacher).not.toHaveBeenCalled()
  })

  it('refuses a teacher outside the school or archived', async () => {
    const gw = gateways({ teachers: [] })

    expect(await run(gw)).toBe('teacherNotFound')
    expect(gw.classPeriodGw.assignTeacher).not.toHaveBeenCalled()
  })

  it('refuses a malformed id', async () => {
    const gw = gateways()

    expect(await run(gw, { schoolId, id: 'bad', teacherId })).toBe('validationError')
    expect(gw.classPeriodGw.findById).not.toHaveBeenCalled()
  })
})
