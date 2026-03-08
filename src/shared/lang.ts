export type Result<Failure, Success = 'OK'> = Failure | Success

export function isFailure<F>(result: Result<F>): result is F {
  return result !== 'OK'
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}
