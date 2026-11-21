import { describe, expect, it, vi } from 'vitest'
import { refreshAttendanceRosterFromMcp } from './refresh-attendance-roster'

const SESSION = '11111111-1111-4111-8111-111111111111'
const scope = { schoolId: 'school-1', userId: 'user-1' }

function deps(enabled = 'true', result: unknown = { added: [] }) {
  return {
    readConfig: vi.fn().mockResolvedValue({ value: enabled }),
    refresh: vi.fn().mockResolvedValue(result),
  }
}

describe('refreshAttendanceRosterFromMcp', () => {
  it('adds the new students as not recorded, in the scope school', async () => {
    const added = [{ studentId: 'st', studentName: 'Nouroudini Yusri' }]
    const d = deps('true', { added })

    const result = await refreshAttendanceRosterFromMcp(
      scope,
      { sessionId: SESSION, schoolId: 'other' } as never,
      d as never
    )

    expect(d.refresh).toHaveBeenCalledWith({
      schoolId: 'school-1',
      sessionId: SESSION,
      actorId: 'user-1',
      status: 'NOT_RECORDED',
    })
    expect(result).toEqual({ sessionId: SESSION, added })
  })

  it('is refused when attendance is off', async () => {
    const d = deps('false')

    expect(await refreshAttendanceRosterFromMcp(scope, { sessionId: SESSION }, d as never)).toBe(
      'notConfigured'
    )
    expect(d.refresh).not.toHaveBeenCalled()
  })

  it('passes the refusal of a call from another school or already validated', async () => {
    expect(
      await refreshAttendanceRosterFromMcp(
        scope,
        { sessionId: SESSION },
        deps('true', 'notFound') as never
      )
    ).toBe('notFound')
    expect(
      await refreshAttendanceRosterFromMcp(
        scope,
        { sessionId: SESSION },
        deps('true', 'invalidTransition') as never
      )
    ).toBe('invalidTransition')
  })

  it('rejects a malformed session id', async () => {
    expect(await refreshAttendanceRosterFromMcp(scope, { sessionId: 'x' }, deps() as never)).toBe(
      'validationError'
    )
  })
})
