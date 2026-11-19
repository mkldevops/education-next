import { describe, expect, it } from 'vitest'
import { type AttendanceGridSession, buildAttendanceGrid } from './attendance-grid'

const session = (
  id: string,
  date: string,
  entries: AttendanceGridSession['entries'],
  startTime: string | null = null
): AttendanceGridSession => ({
  id,
  occurredOn: new Date(`${date}T00:00:00.000Z`),
  occurrenceKey: startTime ? `slot-${id}` : 'daily',
  classScheduleSlotId: startTime ? `slot-${id}` : null,
  startTime,
  entries,
})

describe('buildAttendanceGrid', () => {
  it('orders columns by date then start time', () => {
    const { columns } = buildAttendanceGrid(
      [
        session('c', '2026-11-09', []),
        session('b', '2026-11-02', [], '14:00'),
        session('a', '2026-11-02', [], '08:30'),
      ],
      new Map()
    )
    expect(columns.map((column) => column.sessionId)).toEqual(['a', 'b', 'c'])
  })

  it('fills missing entries with null and counts absences and lates', () => {
    const { rows } = buildAttendanceGrid(
      [
        session('s1', '2026-11-02', [
          { studentId: 'yanis', studentName: 'Benali Yanis', status: 'ABSENT' },
          { studentId: 'lina', studentName: 'Saïd Lina', status: 'LATE' },
        ]),
        session('s2', '2026-11-09', [
          { studentId: 'yanis', studentName: 'Benali Yanis', status: 'ABSENT' },
        ]),
      ],
      new Map([['lina', new Date('2026-11-02T00:00:00.000Z')]])
    )
    expect(rows).toEqual([
      expect.objectContaining({
        studentId: 'yanis',
        cells: ['ABSENT', 'ABSENT'],
        absences: 2,
        lastPresentOn: null,
      }),
      expect.objectContaining({ studentId: 'lina', cells: ['LATE', null], absences: 0, lates: 1 }),
    ])
  })

  it('lists students who have not attended for the longest time first', () => {
    const entry = (studentId: string) => ({
      studentId,
      studentName: studentId,
      status: 'ABSENT' as const,
    })
    const { rows } = buildAttendanceGrid(
      [
        session('s1', '2026-11-02', [
          entry('recent'),
          entry('old'),
          entry('never-b'),
          entry('never-a'),
        ]),
      ],
      new Map([
        ['recent', new Date('2026-11-01T00:00:00.000Z')],
        ['old', new Date('2026-10-01T00:00:00.000Z')],
      ])
    )
    expect(rows.map((row) => row.studentId)).toEqual(['never-a', 'never-b', 'old', 'recent'])
  })
})
