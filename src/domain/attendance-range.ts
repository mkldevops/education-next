import { attendanceUtcDate } from './attendance-date'

export const ATTENDANCE_RANGE_PRESETS = ['last15', 'last30', 'month', 'last60'] as const

export type AttendanceRangePreset = (typeof ATTENDANCE_RANGE_PRESETS)[number]

export type AttendanceRange = {
  preset: AttendanceRangePreset | 'custom'
  from: Date
  to: Date
}

export const DEFAULT_ATTENDANCE_RANGE_PRESET: AttendanceRangePreset = 'last30'

/** Bornes d'une plage personnalisée : au-delà, la grille devient illisible et la requête coûteuse. */
export const ATTENDANCE_RANGE_MAX_DAYS = 93

function shiftDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
}

const MISSING = new Date(Number.NaN)

function parseDay(value: string | undefined) {
  const date = attendanceUtcDate(value, MISSING)
  return date === MISSING ? null : date
}

function isPreset(value: string | undefined): value is AttendanceRangePreset {
  return ATTENDANCE_RANGE_PRESETS.some((preset) => preset === value)
}

export function attendanceRangePreset(preset: AttendanceRangePreset, today: Date): AttendanceRange {
  const to = shiftDays(today, 0)
  switch (preset) {
    case 'last15':
      return { preset, from: shiftDays(to, -14), to }
    case 'last30':
      return { preset, from: shiftDays(to, -29), to }
    case 'last60':
      return { preset, from: shiftDays(to, -59), to }
    case 'month':
      return { preset, from: new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1)), to }
  }
}

/**
 * Lit la plage demandée dans l'URL. Une plage personnalisée invalide retombe sur le préréglage par
 * défaut ; des bornes inversées sont remises dans l'ordre et une plage trop longue est raccourcie
 * par le début pour garder la date de fin choisie.
 */
export function resolveAttendanceRange(
  input: { range?: string; from?: string; to?: string },
  today: Date
): AttendanceRange {
  if (isPreset(input.range)) return attendanceRangePreset(input.range, today)
  if (input.range === 'custom') {
    const from = parseDay(input.from)
    const to = parseDay(input.to)
    if (from && to) {
      const [start, end] = from <= to ? [from, to] : [to, from]
      const earliest = shiftDays(end, -(ATTENDANCE_RANGE_MAX_DAYS - 1))
      return {
        preset: 'custom',
        from: new Date(Math.max(start.getTime(), earliest.getTime())),
        to: end,
      }
    }
  }
  return attendanceRangePreset(DEFAULT_ATTENDANCE_RANGE_PRESET, today)
}
