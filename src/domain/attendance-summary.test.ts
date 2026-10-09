import { describe, expect, it } from 'vitest'
import { summarizeAttendance } from './attendance-summary'

describe('summarizeAttendance', () => {
  it('counts each status and rates attendance over recorded entries', () => {
    expect(summarizeAttendance(['PRESENT', 'LATE', 'ABSENT', 'NOT_RECORDED', 'PRESENT'])).toEqual({
      present: 2,
      late: 1,
      absent: 1,
      notRecorded: 1,
      rate: 75,
    })
  })

  it('has no rate when nothing was recorded', () => {
    expect(summarizeAttendance(['NOT_RECORDED']).rate).toBeNull()
    expect(summarizeAttendance([]).rate).toBeNull()
  })
})
