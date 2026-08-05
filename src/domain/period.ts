export function validatePeriodDates(startAt: Date, endAt: Date): 'OK' | 'invalidDates' {
  if (endAt <= startAt) {
    return 'invalidDates'
  }
  return 'OK'
}

export type PeriodCandidate = {
  startAt: Date
  endAt: Date
  hasClasses: boolean
}

export function selectDefaultPeriod<T extends PeriodCandidate>(periods: T[], now: Date): T | null {
  const byRecency = [...periods].sort((a, b) => b.startAt.getTime() - a.startAt.getTime())

  return (
    byRecency.find((period) => period.startAt <= now && now <= period.endAt) ??
    byRecency.find((period) => period.hasClasses) ??
    byRecency[0] ??
    null
  )
}

export function checkOverlap(
  startAt: Date,
  endAt: Date,
  existingPeriods: Array<{ startAt: Date; endAt: Date }>
): 'OK' | 'overlappingPeriod' {
  const hasOverlap = existingPeriods.some((period) => {
    return startAt < period.endAt && endAt > period.startAt
  })

  if (hasOverlap) {
    return 'overlappingPeriod'
  }

  return 'OK'
}
