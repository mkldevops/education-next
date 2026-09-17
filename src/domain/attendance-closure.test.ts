import { describe, expect, it } from 'vitest'
import { isAttendanceClosed } from './attendance-closure'

describe('isAttendanceClosed', () => {
  const day = new Date('2026-01-05T00:00:00.000Z')
  it('closes only a published overlapping closure', () => {
    expect(
      isAttendanceClosed([{ status: 'PUBLISHED', category: 'CLOSURE', startAt: day }], day)
    ).toBe(true)
    expect(isAttendanceClosed([{ status: 'DRAFT', category: 'CLOSURE', startAt: day }], day)).toBe(
      false
    )
    expect(
      isAttendanceClosed([{ status: 'PUBLISHED', category: 'OUTING', startAt: day }], day)
    ).toBe(false)
  })

  it('uses an exclusive end-of-day boundary', () => {
    expect(
      isAttendanceClosed(
        [
          {
            status: 'PUBLISHED',
            category: 'CLOSURE',
            startAt: new Date('2026-01-06T00:00:00.000Z'),
          },
        ],
        day
      )
    ).toBe(false)
  })
})
