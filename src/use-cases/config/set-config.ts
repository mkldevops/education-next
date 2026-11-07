import type { z } from 'zod'
import { ATTENDANCE_ENTRY_MODES } from '@/domain/attendance-entry-mode'
import { ATTENDANCE_FREQUENCIES } from '@/domain/attendance-frequency'
import { configGateway } from '@/gateways/config-gateway'
import {
  ATTENDANCE_ENTRY_MODE_CONFIG_KEY,
  ATTENDANCE_FREQUENCY_CONFIG_KEY,
} from '@/lib/attendance-config'
import {
  CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY,
  ClassScheduleVisibility,
} from '@/lib/class-schedule-config'
import { SCHOOL_CONFIG_VALUE_TYPES } from '@/lib/school-config'
import { isHexColor } from '@/lib/theme-palettes'
import { setConfigSchema } from './schemas'

type Input = z.infer<typeof setConfigSchema>

/**
 * Le seul réglage NUMBER est un effectif (`max_students_per_class`) : un entier d'au moins 1.
 * `Number('')` vaut 0 et `Number('1e2')` vaut 100, d'où le motif plutôt qu'une conversion.
 */
function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) >= 1 && Number.isSafeInteger(Number(value))
}

function validateValueType(value: string, valueType: string): boolean {
  switch (valueType) {
    case 'BOOLEAN':
      return value === 'true' || value === 'false'
    // La valeur d'une couleur est injectée telle quelle dans le `<style>` du layout : sans
    // format imposé, un administrateur d'école peut refermer la règle et écrire le CSS de
    // son choix sur toutes les pages de son école.
    case 'COLOR':
      return isHexColor(value)
    default:
      return true
  }
}

export async function setConfig(input: Input, configGw = configGateway) {
  const parsed = setConfigSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, name, value } = parsed.data
  if (
    name === CLASS_SCHEDULE_VISIBILITY_CONFIG_KEY &&
    value !== ClassScheduleVisibility.Internal &&
    value !== ClassScheduleVisibility.Public
  ) {
    return 'invalidConfigValue' as const
  }
  if (
    name === ATTENDANCE_FREQUENCY_CONFIG_KEY &&
    !ATTENDANCE_FREQUENCIES.some((frequency) => frequency === value)
  ) {
    return 'invalidConfigValue' as const
  }
  if (
    name === ATTENDANCE_ENTRY_MODE_CONFIG_KEY &&
    !ATTENDANCE_ENTRY_MODES.some((mode) => mode === value)
  ) {
    return 'invalidConfigValue' as const
  }
  const valueType = SCHOOL_CONFIG_VALUE_TYPES[name]
  if (valueType === 'NUMBER' && !isPositiveInteger(value)) {
    return 'invalidNumber' as const
  }
  if (!validateValueType(value, valueType)) {
    return 'invalidConfigValue' as const
  }

  const config = await configGw.set(schoolId, { name, value, valueType })
  return config
}
