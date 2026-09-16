import { cache } from 'react'
import { classScheduleGateway } from '@/gateways/class-schedule-gateway'
import { configGateway } from '@/gateways/config-gateway'
import { schoolGateway } from '@/gateways/school-gateway'
import {
  CLASS_SCHEDULE_ENABLED_CONFIG_KEY,
  CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY,
  ClassScheduleVisibility,
} from '@/lib/class-schedule-config'

export type PublicClassScheduleResult =
  | 'notFound'
  | {
      school: { id: string; name: string; slug: string }
      slots: Awaited<ReturnType<typeof classScheduleGateway.listPublicBySchoolAndPeriod>>
    }

const resolvePublicClassSchedule = cache(
  async (
    slug: string,
    periodId: string,
    schoolGw: typeof schoolGateway,
    configGw: typeof configGateway,
    scheduleGw: typeof classScheduleGateway
  ): Promise<PublicClassScheduleResult> => {
    const school = await schoolGw.findBySlug(slug)
    if (!school?.isActive) return 'notFound'

    const [enabled, visibility] = await Promise.all([
      configGw.get(school.id, CLASS_SCHEDULE_ENABLED_CONFIG_KEY),
      configGw.get(school.id, CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY),
    ])
    if (enabled?.value !== 'true' || visibility?.value !== ClassScheduleVisibility.Public) {
      return 'notFound'
    }

    const slots = await scheduleGw.listPublicBySchoolAndPeriod(school.id, periodId)
    return { school: { id: school.id, name: school.name, slug: school.slug }, slots }
  }
)

export function listPublicClassSchedule(
  slug: string,
  periodId: string,
  schoolGw: typeof schoolGateway = schoolGateway,
  configGw: typeof configGateway = configGateway,
  scheduleGw: typeof classScheduleGateway = classScheduleGateway
): Promise<PublicClassScheduleResult> {
  return resolvePublicClassSchedule(slug, periodId, schoolGw, configGw, scheduleGw)
}
