import { describe, expect, it } from 'vitest'
import { parseSchoolId } from './school-arg.mjs'

describe('parseSchoolId', () => {
  it('reads both spellings of the option', () => {
    expect(parseSchoolId(['--school-id', 'abc'])).toBe('abc')
    expect(parseSchoolId(['--school-id=abc'])).toBe('abc')
  })

  it('ignores the other arguments', () => {
    expect(parseSchoolId(['--dry-run', '--school-id', 'abc', '--verbose'])).toBe('abc')
  })

  // The refusal is the point of this module: with no school, the cleanup phase would
  // have nothing to restrict itself to.
  it('refuses a missing option', () => {
    expect(() => parseSchoolId([])).toThrow('Missing required option')
  })

  it('refuses a value that is empty or swallowed by the next option', () => {
    expect(() => parseSchoolId(['--school-id'])).toThrow('requires a value')
    expect(() => parseSchoolId(['--school-id', '--verbose'])).toThrow('requires a value')
    expect(() => parseSchoolId(['--school-id='])).toThrow('requires a value')
  })
})
