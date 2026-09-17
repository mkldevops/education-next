import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  event: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  eventImage: {
    count: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy. Même
// motif que `class-period-gateway.test.ts` et `school-gateway.test.ts`.
const { eventGateway } = await import('../event-gateway')

const SCHOOL = 'school-1'
const EVENT_ID = 'event-1'

function withTransaction() {
  const tx = {
    eventImage: {
      delete: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
  }
  dbMock.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx))
  return tx
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('eventGateway.removeImage', () => {
  it('deletes the targeted image scoped to the school', async () => {
    const tx = withTransaction()

    await eventGateway.removeImage(SCHOOL, EVENT_ID, 'img-0')

    expect(tx.eventImage.delete).toHaveBeenCalledWith({
      where: { id_schoolId: { id: 'img-0', schoolId: SCHOOL } },
    })
  })

  it('keeps the deletion and the renumbering inside one transaction', async () => {
    withTransaction()

    await eventGateway.removeImage(SCHOOL, EVENT_ID, 'img-0')

    expect(dbMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it('compacts the remaining positions to 0..n-1 after removing the cover image', async () => {
    const tx = withTransaction()
    tx.eventImage.findMany.mockResolvedValue([
      { id: 'img-1', schoolId: SCHOOL, eventId: EVENT_ID, position: 1 },
      { id: 'img-2', schoolId: SCHOOL, eventId: EVENT_ID, position: 2 },
    ])

    await eventGateway.removeImage(SCHOOL, EVENT_ID, 'img-0')

    expect(tx.eventImage.findMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, eventId: EVENT_ID },
      orderBy: { position: 'asc' },
    })
    // `img-1` devient la nouvelle couverture (position 0) : la renumérotation, pas
    // seulement la suppression, est ce qui maintient `position = 0` comme image
    // principale.
    expect(tx.eventImage.update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: 'img-1', schoolId: SCHOOL } },
      data: { position: 0 },
    })
    expect(tx.eventImage.update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: 'img-2', schoolId: SCHOOL } },
      data: { position: 1 },
    })
  })

  it('leaves the untouched cover alone when removing a middle image', async () => {
    const tx = withTransaction()
    tx.eventImage.findMany.mockResolvedValue([
      { id: 'img-0', schoolId: SCHOOL, eventId: EVENT_ID, position: 0 },
      { id: 'img-2', schoolId: SCHOOL, eventId: EVENT_ID, position: 2 },
    ])

    await eventGateway.removeImage(SCHOOL, EVENT_ID, 'img-1')

    expect(tx.eventImage.update).toHaveBeenCalledTimes(1)
    expect(tx.eventImage.update).toHaveBeenCalledWith({
      where: { id_schoolId: { id: 'img-2', schoolId: SCHOOL } },
      data: { position: 1 },
    })
  })

  it('rewrites nothing when the remaining positions are already compact', async () => {
    const tx = withTransaction()
    tx.eventImage.findMany.mockResolvedValue([
      { id: 'img-1', schoolId: SCHOOL, eventId: EVENT_ID, position: 0 },
    ])

    await eventGateway.removeImage(SCHOOL, EVENT_ID, 'img-0')

    expect(tx.eventImage.update).not.toHaveBeenCalled()
  })
})

describe('eventGateway.listUpcoming', () => {
  it('loads only the cover image for each dashboard event', async () => {
    dbMock.event.findMany.mockResolvedValue([])

    await eventGateway.listUpcoming(
      SCHOOL,
      ['PUBLIC', 'MEMBERS'],
      new Date('2026-09-17T00:00:00.000Z'),
      5
    )

    expect(dbMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { images: { orderBy: { position: 'asc' }, take: 1 } },
      })
    )
  })
})
