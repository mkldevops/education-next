import { describe, expect, it, vi } from 'vitest'
import type { classScheduleGateway } from '@/gateways/class-schedule-gateway'
import type { configGateway } from '@/gateways/config-gateway'
import type { schoolGateway } from '@/gateways/school-gateway'
import { listPublicClassSchedule } from './list-public-class-schedule'

const school = { id: 'school-1', name: 'École', slug: 'ecole', isActive: true }

function gateways(visibility: 'INTERNAL' | 'PUBLIC') {
  const listPublicBySchoolAndPeriod = vi.fn().mockResolvedValue([])
  const schoolGw = {
    findBySlug: vi.fn().mockResolvedValue(school),
  } as unknown as typeof schoolGateway
  const configGw = {
    get: vi.fn(async (_schoolId: string, name: string) => ({
      value: name === 'class_schedule_enabled' ? 'true' : visibility,
    })),
  } as unknown as typeof configGateway
  const scheduleGw = { listPublicBySchoolAndPeriod } as unknown as typeof classScheduleGateway
  return { schoolGw, configGw, scheduleGw, listPublicBySchoolAndPeriod }
}

describe('listPublicClassSchedule', () => {
  it('keeps an internal schedule private', async () => {
    const mocks = gateways('INTERNAL')

    const result = await listPublicClassSchedule(
      school.slug,
      'period-1',
      mocks.schoolGw,
      mocks.configGw,
      mocks.scheduleGw
    )

    expect(result).toBe('notFound')
    expect(mocks.listPublicBySchoolAndPeriod).not.toHaveBeenCalled()
  })

  it('returns slots only when the schedule is enabled and public', async () => {
    const mocks = gateways('PUBLIC')

    const result = await listPublicClassSchedule(
      school.slug,
      'period-1',
      mocks.schoolGw,
      mocks.configGw,
      mocks.scheduleGw
    )

    expect(result).toEqual({
      school: { id: school.id, name: school.name, slug: school.slug },
      slots: [],
    })
    expect(mocks.listPublicBySchoolAndPeriod).toHaveBeenCalledWith(school.id, 'period-1')
  })
})
