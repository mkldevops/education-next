export const ATTENDANCE_ENABLED_CONFIG_KEY = 'attendance_enabled'

export const ATTENDANCE_ENABLED_CONFIG_DEFAULT = {
  name: ATTENDANCE_ENABLED_CONFIG_KEY,
  value: 'false',
  valueType: 'BOOLEAN',
} as const

export const ATTENDANCE_FREQUENCY_CONFIG_KEY = 'attendance_frequency'

export const ATTENDANCE_FREQUENCY_CONFIG_DEFAULT = {
  name: ATTENDANCE_FREQUENCY_CONFIG_KEY,
  value: 'PER_SLOT',
  valueType: 'TEXT',
} as const
