import { describe, expect, it, vi } from 'vitest'
import { duplicateEventFromMcp } from './duplicate-event'

type Duplicate = NonNullable<Parameters<typeof duplicateEventFromMcp>[2]>

const scope = { schoolId: 'school-1' }
const eventId = '123e4567-e89b-12d3-a456-426614174000'

const run = (input: Record<string, unknown>, duplicate: Duplicate) =>
  duplicateEventFromMcp(scope, input as never, duplicate)

describe('duplicateEventFromMcp', () => {
  it('duplicates in the key school and publishes the draft without its school id', async () => {
    const duplicate = vi.fn().mockResolvedValue({
      id: 'event-2',
      schoolId: 'school-1',
      slug: 'fete-2027',
      title: 'Fête 2027',
      category: 'CELEBRATION',
      visibility: 'MEMBERS',
      status: 'DRAFT',
      allDay: true,
      startAt: new Date('2027-06-20T00:00:00.000Z'),
      endAt: null,
      location: null,
    })

    const result = await run({ id: eventId, title: 'Fête 2027', schoolId: 'x' }, duplicate)

    expect(duplicate).toHaveBeenCalledWith({
      id: eventId,
      title: 'Fête 2027',
      schoolId: 'school-1',
    })
    expect(result).toMatchObject({ id: 'event-2', status: 'DRAFT' })
    expect(result).not.toHaveProperty('schoolId')
  })

  it('surfaces slugTaken and refuses a missing title', async () => {
    const duplicate = vi.fn().mockResolvedValue('slugTaken')

    expect(await run({ id: eventId, title: 'Fête' }, duplicate)).toBe('slugTaken')
    expect(await run({ id: eventId }, duplicate)).toBe('validationError')
    expect(duplicate).toHaveBeenCalledTimes(1)
  })
})
