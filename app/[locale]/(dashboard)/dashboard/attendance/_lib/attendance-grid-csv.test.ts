import { describe, expect, it } from 'vitest'
import { attendanceGridCsv } from './attendance-grid-csv'

describe('attendanceGridCsv', () => {
  it('writes one line per student with status codes and escapes separators', () => {
    const csv = attendanceGridCsv({
      columns: [
        {
          key: 's-1',
          sessionId: 's-1',
          occurredOn: new Date('2026-11-07T00:00:00.000Z'),
          occurrenceKey: 'daily',
          classScheduleSlotId: null,
          startTime: null,
          state: 'VALIDATED',
        },
        {
          key: '2026-11-11:daily',
          sessionId: null,
          occurredOn: new Date('2026-11-11T00:00:00.000Z'),
          occurrenceKey: 'daily',
          classScheduleSlotId: 'slot-1',
          startTime: '09:00',
          state: 'missed',
        },
      ],
      rows: [
        {
          studentId: 'st-1',
          studentName: 'Benali; "Yanis"',
          cells: ['ABSENT', null],
          absences: 1,
          lates: 0,
          lastPresentOn: null,
        },
      ],
      columnLabel: () => '7 nov.',
      dayLabel: () => '',
      codes: { PRESENT: 'P', LATE: 'R', ABSENT: 'A', NOT_RECORDED: '·' },
      headers: {
        student: 'Élève',
        absences: 'Absences',
        lates: 'Retards',
        lastPresence: 'Dernière présence',
        never: 'Jamais',
      },
    })
    expect(csv.split('\r\n')).toEqual([
      'Élève;7 nov.;Absences;Retards;Dernière présence',
      '"Benali; ""Yanis""";A;1;0;Jamais',
    ])
  })
})
