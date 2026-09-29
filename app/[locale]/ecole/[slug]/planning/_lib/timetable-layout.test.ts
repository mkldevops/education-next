import { describe, expect, it } from 'vitest'
import { choosePrintOrientation, printLabelEm } from './timetable-layout'

function slot(weekday: number, startTime: string, endTime: string, level = 'CP') {
  return {
    weekday,
    startTime,
    endTime,
    description: null,
    classPeriod: { level: { name: level } },
    teachers: [{ teacher: { firstName: 'Amina', lastName: 'Benali' } }],
  }
}

describe('choosePrintOrientation', () => {
  it('prints a two-day weekend schedule in portrait', () => {
    const slots = [1, 2, 3].flatMap((index) => [
      slot(6, '09:00', '12:00', `C${index}`),
      slot(6, '13:00', '16:00', `C${index}`),
      slot(7, '09:00', '12:00', `C${index}`),
      slot(7, '13:00', '16:00', `C${index}`),
    ])

    expect(choosePrintOrientation(slots, false)).toBe('portrait')
  })

  it('prints a full week of short courses in landscape', () => {
    const slots = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
      slot(weekday, '14:00', '17:00', 'CE1'),
      slot(weekday, '14:00', '17:00', 'CE2'),
    ])

    expect(choosePrintOrientation(slots, false)).toBe('landscape')
  })

  it('defaults to portrait without courses', () => {
    expect(choosePrintOrientation([], false)).toBe('portrait')
  })
})

describe('printLabelEm', () => {
  it('grows with the longest level and teacher label', () => {
    expect(printLabelEm([slot(1, '09:00', '10:00', 'CP')], false)).toBeLessThan(
      printLabelEm([slot(1, '09:00', '10:00', 'Niveau préparatoire avancé')], false)
    )
  })
})
