import { describe, expect, it } from 'vitest'
import { splitTeacherName } from './teacher'

describe('splitTeacherName', () => {
  it('keeps a single word as the first name', () => {
    expect(splitTeacherName(' Kaniza ')).toEqual({ firstName: 'Kaniza', lastName: '' })
  })

  it('takes the first word as first name and the rest as last name', () => {
    expect(splitTeacherName('Ali  Ben Zakia')).toEqual({ firstName: 'Ali', lastName: 'Ben Zakia' })
  })
})
