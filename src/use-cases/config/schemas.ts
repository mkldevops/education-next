import { z } from 'zod'
import { SchoolConfigKey } from '@/lib/school-config'
import { THEME_COLOR_KEYS } from '@/lib/theme-palettes'

export const setConfigSchema = z.object({
  schoolId: z.string().min(1),
  name: z.enum(SchoolConfigKey),
  value: z.string(),
})

export const getConfigSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(250),
})

export const setThemeColorsSchema = z.object({
  schoolId: z.string().min(1),
  colors: z.partialRecord(z.enum(THEME_COLOR_KEYS), z.string()),
})
