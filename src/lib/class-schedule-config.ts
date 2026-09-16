export const CLASS_SCHEDULE_ENABLED_CONFIG_KEY = 'class_schedule_enabled'
export const CLASS_SCHEDULE_TEACHER_OVERLAP_ALLOWED_CONFIG_KEY =
  'class_schedule_teacher_overlap_allowed'
export const CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY = 'class_schedule_visibility'

export const ClassScheduleVisibility = {
  Internal: 'INTERNAL',
  Public: 'PUBLIC',
} as const

export type ClassScheduleVisibility =
  (typeof ClassScheduleVisibility)[keyof typeof ClassScheduleVisibility]

/** Le planning est fermé par défaut, mais les écoles qui l'ouvrent peuvent garder leur
 * souplesse en autorisant les chevauchements jusqu'à décision contraire. */
export const CLASS_SCHEDULE_CONFIG_DEFAULTS = [
  { name: CLASS_SCHEDULE_ENABLED_CONFIG_KEY, value: 'false', valueType: 'BOOLEAN' },
  {
    name: CLASS_SCHEDULE_TEACHER_OVERLAP_ALLOWED_CONFIG_KEY,
    value: 'true',
    valueType: 'BOOLEAN',
  },
  {
    name: CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY,
    value: ClassScheduleVisibility.Internal,
    valueType: 'TEXT',
  },
] as const
