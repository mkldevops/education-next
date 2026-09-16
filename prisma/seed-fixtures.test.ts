import { describe, expect, it } from 'vitest'
import {
  DEMO_CLASSES,
  DEMO_EVENTS,
  DEMO_FAMILIES,
  DEMO_SCHEDULE_SLOTS,
  DEMO_TEACHERS,
  EXPECTED_SEED_COUNTS,
} from './seed-fixtures'

describe('demo seed fixtures', () => {
  it('fills every active level with a teacher and a weekly schedule', () => {
    expect(DEMO_CLASSES).toHaveLength(5)
    expect(DEMO_TEACHERS).toHaveLength(DEMO_CLASSES.length)
    expect(DEMO_SCHEDULE_SLOTS).toHaveLength(4)
    expect(EXPECTED_SEED_COUNTS.scheduleSlotsPerSchool).toBe(20)
    expect(new Set(DEMO_SCHEDULE_SLOTS.map((slot) => slot.weekday)).size).toBe(4)
    expect(new Set(DEMO_CLASSES.map((classPeriod) => classPeriod.levelIndex)).size).toBe(5)
  })

  it('creates enough families and students for useful list and class views', () => {
    expect(DEMO_FAMILIES).toHaveLength(5)
    expect(EXPECTED_SEED_COUNTS.familiesPerSchool).toBe(7)
    expect(EXPECTED_SEED_COUNTS.studentsPerSchool).toBe(10)
    expect(DEMO_FAMILIES.some((family) => family.children.length > 1)).toBe(true)
    expect(
      DEMO_FAMILIES.every((family) =>
        family.children.every((child) => child.levelIndex < DEMO_CLASSES.length)
      )
    ).toBe(true)
  })

  it('covers event categories, audiences, and lifecycle states', () => {
    expect(DEMO_EVENTS).toHaveLength(8)
    expect(new Set(DEMO_EVENTS.map((event) => event.visibility))).toEqual(
      new Set(['PUBLIC', 'MEMBERS', 'STAFF'])
    )
    expect(new Set(DEMO_EVENTS.map((event) => event.status))).toEqual(
      new Set(['PUBLISHED', 'DRAFT', 'CANCELLED'])
    )
    expect(new Set(DEMO_EVENTS.map((event) => event.category)).size).toBeGreaterThanOrEqual(6)
    expect(new Set(DEMO_EVENTS.map((event) => event.slug)).size).toBe(DEMO_EVENTS.length)
  })
})
