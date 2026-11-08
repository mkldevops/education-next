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

export const ATTENDANCE_ENTRY_MODE_CONFIG_KEY = 'attendance_entry_mode'

export const ATTENDANCE_ENTRY_MODE_CONFIG_DEFAULT = {
  name: ATTENDANCE_ENTRY_MODE_CONFIG_KEY,
  value: 'LIST',
  valueType: 'TEXT',
} as const

export const ATTENDANCE_ABSENCE_REASON_REQUIRED_CONFIG_KEY = 'attendance_absence_reason_required'

export const ATTENDANCE_ABSENCE_REASON_REQUIRED_CONFIG_DEFAULT = {
  name: ATTENDANCE_ABSENCE_REASON_REQUIRED_CONFIG_KEY,
  value: 'false',
  valueType: 'BOOLEAN',
} as const
