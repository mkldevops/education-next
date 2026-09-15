import { describe, expect, it, vi } from 'vitest'
import type { eventGateway } from '@/gateways/event-gateway'
import type { EventVisibility } from '@/generated/prisma/client'
import { listUpcomingEvents } from './list-upcoming-events'

function fakeGateway() {
  const listUpcoming = vi.fn(
    async (_schoolId: string, _visibilities: EventVisibility[], _from: Date, _take?: number) =>
      [] as unknown[]
  )
  return { gw: { listUpcoming } as unknown as typeof eventGateway, listUpcoming }
}

describe('listUpcomingEvents', () => {
  it('scopes a parent (MEMBER) viewer to public and member events only', async () => {
    const { gw, listUpcoming } = fakeGateway()

    await listUpcomingEvents('school-1', 'MEMBER', gw, new Date('2026-09-10T12:00:00Z'))

    expect(listUpcoming).toHaveBeenCalledWith(
      'school-1',
      ['PUBLIC', 'MEMBERS'],
      expect.any(Date),
      10
    )
  })

  it('scopes a staff (admin) viewer to every visibility, staff included', async () => {
    const { gw, listUpcoming } = fakeGateway()

    await listUpcomingEvents('school-1', 'STAFF', gw, new Date('2026-09-10T12:00:00Z'))

    expect(listUpcoming).toHaveBeenCalledWith(
      'school-1',
      ['PUBLIC', 'MEMBERS', 'STAFF'],
      expect.any(Date),
      10
    )
  })

  it('bounds the lookup to the start of today in UTC, not the exact instant, so today stays included', async () => {
    const { gw, listUpcoming } = fakeGateway()

    await listUpcomingEvents('school-1', 'STAFF', gw, new Date('2026-09-10T18:30:00Z'))

    const from = listUpcoming.mock.calls[0]?.[2]
    expect(from?.toISOString()).toBe('2026-09-10T00:00:00.000Z')
  })

  it('caps the fetch to a bounded batch by default, so the banner and the card can share one query', async () => {
    const { gw, listUpcoming } = fakeGateway()

    await listUpcomingEvents('school-1', 'STAFF', gw, new Date('2026-09-10T12:00:00Z'))

    expect(listUpcoming.mock.calls[0]?.[3]).toBe(10)
  })

  it('accepts an explicit take override', async () => {
    const { gw, listUpcoming } = fakeGateway()

    await listUpcomingEvents('school-1', 'STAFF', gw, new Date('2026-09-10T12:00:00Z'), 3)

    expect(listUpcoming.mock.calls[0]?.[3]).toBe(3)
  })
})
