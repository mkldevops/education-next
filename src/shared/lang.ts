export type Result<Failure, Success = 'OK'> = Failure | Success

export type ResultOk = 'OK'

export function isOk<F>(result: Result<F>): result is 'OK' {
  return result === 'OK'
}

export function isFailure<F>(result: Result<F>): result is F {
  return result !== 'OK'
}

export function isSuccess<F, S>(result: Result<F, S>, failures: readonly F[]): result is S {
  return !failures.includes(result as F)
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
