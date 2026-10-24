import { describe, expect, it } from 'vitest'
import { isSchoolClosed } from './school-closure'

const day = new Date('2026-11-04T00:00:00.000Z')
const event = (category: string, startAt: string, endAt?: string) => ({
  status: 'PUBLISHED',
  category,
  startAt: new Date(startAt),
  endAt: endAt ? new Date(endAt) : null,
})

describe('isSchoolClosed', () => {
  it('closes meals on a published closure or holiday', () => {
    expect(isSchoolClosed([event('CLOSURE', '2026-11-04T00:00:00.000Z')], day)).toBe(true)
    expect(isSchoolClosed([event('HOLIDAY', '2026-11-04T00:00:00.000Z')], day)).toBe(true)
    expect(isSchoolClosed([event('OUTING', '2026-11-04T00:00:00.000Z')], day)).toBe(false)
    expect(
      isSchoolClosed([{ ...event('CLOSURE', '2026-11-04T00:00:00.000Z'), status: 'DRAFT' }], day)
    ).toBe(false)
  })

  it('covers every day of a multi-day closure, end day included', () => {
    const closure = [event('CLOSURE', '2026-11-04T00:00:00.000Z', '2026-11-08T00:00:00.000Z')]
    expect(isSchoolClosed(closure, new Date('2026-11-08T00:00:00.000Z'))).toBe(true)
    expect(isSchoolClosed(closure, new Date('2026-11-09T00:00:00.000Z'))).toBe(false)
    expect(isSchoolClosed(closure, new Date('2026-11-03T00:00:00.000Z'))).toBe(false)
  })

  it('keeps attendance on closures only when asked', () => {
    expect(isSchoolClosed([event('HOLIDAY', '2026-11-04T00:00:00.000Z')], day, ['CLOSURE'])).toBe(
      false
    )
  })
})
