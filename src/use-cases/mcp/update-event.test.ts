import { describe, expect, it, vi } from 'vitest'
import { updateEventFromMcp } from './update-event'

type Update = NonNullable<Parameters<typeof updateEventFromMcp>[2]>

const scope = { schoolId: 'school-1' }
const eventId = '123e4567-e89b-12d3-a456-426614174000'

const updated = {
  id: eventId,
  schoolId: 'school-1',
  slug: 'reunion-parents',
  title: 'Réunion parents',
  summary: null,
  description: null,
  category: 'MEETING',
  visibility: 'MEMBERS',
  status: 'DRAFT',
  allDay: false,
  startAt: new Date('2026-12-03T18:00:00.000Z'),
  endAt: null,
  location: null,
  announceDaysBefore: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const run = (input: Record<string, unknown>, update: Update) =>
  updateEventFromMcp(scope, input as never, update)

describe('updateEventFromMcp', () => {
  it('delegates to updateEvent restricted to drafts, in the key school', async () => {
    const update = vi.fn().mockResolvedValue(updated)

    const result = await run({ id: eventId, title: 'Réunion parents', schoolId: 'x' }, update)

    expect(update).toHaveBeenCalledWith(
      { id: eventId, title: 'Réunion parents', schoolId: 'school-1' },
      undefined,
      undefined,
      { draftOnly: true }
    )
    expect(result).toMatchObject({ id: eventId, status: 'DRAFT' })
    expect(result).not.toHaveProperty('schoolId')
  })

  it('reads a new start as a wall clock and derives allDay from its shape', async () => {
    const update = vi.fn().mockResolvedValue(updated)

    await run({ id: eventId, startAt: '2026-12-03T18:00', endAt: null }, update)

    expect(update.mock.calls[0][0]).toMatchObject({
      allDay: false,
      startAt: new Date('2026-12-03T18:00:00.000Z'),
      endAt: null,
    })
  })

  it('keeps the stored allDay and dates when the dates are not sent', async () => {
    const update = vi.fn().mockResolvedValue(updated)

    await run({ id: eventId, location: 'Salle 2' }, update)

    const input = update.mock.calls[0][0]
    expect(input).not.toHaveProperty('allDay')
    expect(input).not.toHaveProperty('startAt')
    expect(input).not.toHaveProperty('endAt')
  })

  it('forwards an explicit allDay sent without a new start', async () => {
    const update = vi.fn().mockResolvedValue(updated)

    await run({ id: eventId, allDay: true }, update)

    expect(update.mock.calls[0][0]).toMatchObject({ allDay: true })
    expect(update.mock.calls[0][0]).not.toHaveProperty('startAt')
  })

  it('never forwards a status: publishing stays in the dashboard', async () => {
    const update = vi.fn().mockResolvedValue(updated)

    await run({ id: eventId, status: 'PUBLISHED' }, update)

    expect(update.mock.calls[0][0]).not.toHaveProperty('status')
  })

  it('surfaces the draft refusal and rejects an offset timestamp', async () => {
    const update = vi.fn().mockResolvedValue('notDraft')

    expect(await run({ id: eventId, title: 'Autre' }, update)).toBe('notDraft')
    expect(await run({ id: eventId, startAt: '2026-12-03T18:00:00+01:00' }, update)).toBe(
      'validationError'
    )
    expect(update).toHaveBeenCalledTimes(1)
  })
})
