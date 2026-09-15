import { BRANDING_CONFIG_DEFAULTS } from './branding-config'
import { EVENTS_CONFIG_DEFAULT } from './events-config'
import { PAYMENTS_ENABLED_CONFIG_DEFAULT } from './payment-config'
import { TEACHER_EXPENSES_CONFIG_DEFAULT } from './teacher-expense-config'

export const MAX_STUDENTS_PER_CLASS_CONFIG_KEY = 'max_students_per_class'
export const THEME_PRIMARY_CONFIG_KEY = 'theme_primary'

/**
 * Réglages créés avec l'école. Sans eux, `max_students_per_class` et `theme_primary`
 * sont lus en base par les classes et le layout mais restent inatteignables depuis
 * `/dashboard/config`, qui n'affiche que les lignes existantes.
 *
 * `theme_primary_hover` et `theme_primary_light` sont volontairement absents : les
 * tokens Tailwind les dérivent de la couleur primaire tant qu'ils ne sont pas posés.
 */
export const SCHOOL_CONFIG_DEFAULTS = [
  ...BRANDING_CONFIG_DEFAULTS,
  TEACHER_EXPENSES_CONFIG_DEFAULT,
  EVENTS_CONFIG_DEFAULT,
  // À `'true'` : une école neuve encaisse comme toutes les autres. Aucune migration ne
  // sème la ligne sur une école existante — l'absence vaut activé.
  PAYMENTS_ENABLED_CONFIG_DEFAULT,
  { name: MAX_STUDENTS_PER_CLASS_CONFIG_KEY, value: '30', valueType: 'NUMBER' },
  { name: THEME_PRIMARY_CONFIG_KEY, value: '#3c6e71', valueType: 'COLOR' },
] as const
