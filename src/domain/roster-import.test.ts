import { describe, expect, it } from 'vitest'
import { normalizeRosterText, parseRosterCsv, planRosterImport } from './roster-import'

const classes = [
  { id: 'ps', name: 'PS', capacity: 3, enrolled: 1 },
  { id: 'ms', name: 'MS', capacity: 2, enrolled: 0 },
]

describe('normalizeRosterText', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(normalizeRosterText('  Saïd   ÉLODIE ')).toBe('said elodie')
  })
})

describe('parseRosterCsv', () => {
  it('skips the header and blank lines, and reports incomplete lines', () => {
    const { rows, invalid } = parseRosterCsv(
      'nom;prenom;classe\r\nKAMAL;Mohamed;PS\n\nDARMI;;MS\nSAID;Ali\n'
    )
    expect(rows).toEqual([{ line: 2, lastname: 'KAMAL', name: 'Mohamed', className: 'PS' }])
    expect(invalid).toEqual([4, 5])
  })
})

describe('planRosterImport', () => {
  const row = (line: number, lastname: string, name: string, className: string) => ({
    line,
    lastname,
    name,
    className,
  })

  it('creates new students and skips those already in the class or repeated', () => {
    const plan = planRosterImport(
      [
        row(1, 'Kamal', 'Mohamed', 'ps'),
        row(2, 'DARMI', 'Saïd', 'MS'),
        row(3, 'darmi', 'said', 'MS'),
      ],
      classes,
      [{ lastname: 'KAMAL', name: 'MOHAMED', className: 'PS' }]
    )
    expect(plan.create).toEqual([{ ...row(2, 'DARMI', 'Saïd', 'MS'), classPeriodId: 'ms' }])
    expect(plan.skipped.map((item) => item.line)).toEqual([1, 3])
    expect(plan.unknownClass).toEqual([])
  })

  it('reports unknown classes and classes the import would overfill', () => {
    const plan = planRosterImport(
      [
        row(1, 'A', 'a', 'PS'),
        row(2, 'B', 'b', 'PS'),
        row(3, 'C', 'c', 'PS'),
        row(4, 'D', 'd', 'CP'),
      ],
      classes,
      []
    )
    expect(plan.unknownClass.map((item) => item.line)).toEqual([4])
    expect(plan.overCapacity).toEqual([{ name: 'PS', capacity: 3, total: 4 }])
  })

  it('reports a shared last name without linking families', () => {
    const plan = planRosterImport(
      [row(1, 'KAMAL', 'Mohamed', 'MS'), row(2, 'DARMI', 'Said', 'MS')],
      classes,
      [{ lastname: 'Kamal', name: 'Mohamed', className: 'PS' }]
    )
    expect(plan.sameLastname).toEqual([
      { lastname: 'kamal', students: ['Mohamed (MS)', 'Mohamed (PS)'] },
    ])
  })
})
