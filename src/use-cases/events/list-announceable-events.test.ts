import { describe, expect, it, vi } from 'vitest'
import type { eventGateway } from '@/gateways/event-gateway'
import type { EventVisibility } from '@/generated/prisma/client'
import { listAnnounceableEvents } from './list-announceable-events'

function fakeGateway() {
  const listAnnounceable = vi.fn(
    async (_schoolId: string, _visibilities: EventVisibility[], _from: Date, _take: number) =>
      [] as unknown[]
  )
  return { gw: { listAnnounceable } as unknown as typeof eventGateway, listAnnounceable }
}

describe('listAnnounceableEvents', () => {
  it('scopes a parent (MEMBER) viewer to public and member events only', async () => {
    const { gw, listAnnounceable } = fakeGateway()

    await listAnnounceableEvents('school-1', 'MEMBER', gw, new Date('2026-09-10T12:00:00Z'))

    expect(listAnnounceable).toHaveBeenCalledWith(
      'school-1',
      ['PUBLIC', 'MEMBERS'],
      expect.any(Date),
      10
    )
  })

  it('scopes a staff (admin) viewer to every visibility, staff included', async () => {
    const { gw, listAnnounceable } = fakeGateway()

    await listAnnounceableEvents('school-1', 'STAFF', gw, new Date('2026-09-10T12:00:00Z'))

    expect(listAnnounceable).toHaveBeenCalledWith(
      'school-1',
      ['PUBLIC', 'MEMBERS', 'STAFF'],
      expect.any(Date),
      10
    )
  })

  it('bounds the lookup to the start of today in UTC, not the exact instant, so today stays included', async () => {
    const { gw, listAnnounceable } = fakeGateway()

    await listAnnounceableEvents('school-1', 'STAFF', gw, new Date('2026-09-10T18:30:00Z'))

    const from = listAnnounceable.mock.calls[0]?.[2]
    expect(from?.toISOString()).toBe('2026-09-10T00:00:00.000Z')
  })
})
