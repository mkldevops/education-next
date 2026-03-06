export function validatePeriodDates(startAt: Date, endAt: Date): 'OK' | 'invalidDates' {
  if (endAt <= startAt) {
    return 'invalidDates'
  }
  return 'OK'
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
