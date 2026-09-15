import type { ConfigValueType } from '@/generated/prisma/client'
import { BRANDING_CONFIG_KEYS } from './branding-config'
import { EVENTS_CONFIG_KEY } from './events-config'
import {
  MAX_STUDENTS_PER_CLASS_CONFIG_KEY,
  THEME_PRIMARY_CONFIG_KEY,
} from './school-config-defaults'
import { TEACHER_EXPENSES_CONFIG_KEY } from './teacher-expense-config'

/**
 * Seuls réglages qu'une école peut poser. Un nom libre n'était lu par aucun code et laissait
 * croire qu'il gouvernait quelque chose ; l'ordre de déclaration est celui de l'écran.
 */
export const SchoolConfigKey = {
  LogoUrl: BRANDING_CONFIG_KEYS.logoUrl,
  ThemePrimary: THEME_PRIMARY_CONFIG_KEY,
  ThemePrimaryHover: 'theme_primary_hover',
  ThemePrimaryLight: 'theme_primary_light',
  ThemeBackground: 'theme_background',
  MaxStudentsPerClass: MAX_STUDENTS_PER_CLASS_CONFIG_KEY,
  TeacherExpensesEnabled: TEACHER_EXPENSES_CONFIG_KEY,
  AutomaticPromotion: 'automatic_promotion',
  EventsEnabled: EVENTS_CONFIG_KEY,
} as const

export type SchoolConfigKey = (typeof SchoolConfigKey)[keyof typeof SchoolConfigKey]

/** Le type d'une valeur est fixé par sa clé : le client ne le choisit plus. */
export const SCHOOL_CONFIG_VALUE_TYPES: Record<SchoolConfigKey, ConfigValueType> = {
  [SchoolConfigKey.LogoUrl]: 'TEXT',
  [SchoolConfigKey.ThemePrimary]: 'COLOR',
  [SchoolConfigKey.ThemePrimaryHover]: 'COLOR',
  [SchoolConfigKey.ThemePrimaryLight]: 'COLOR',
  [SchoolConfigKey.ThemeBackground]: 'COLOR',
  [SchoolConfigKey.MaxStudentsPerClass]: 'NUMBER',
  [SchoolConfigKey.TeacherExpensesEnabled]: 'BOOLEAN',
  [SchoolConfigKey.AutomaticPromotion]: 'BOOLEAN',
  [SchoolConfigKey.EventsEnabled]: 'BOOLEAN',
}

export const SCHOOL_CONFIG_KEYS = Object.values(SchoolConfigKey)
