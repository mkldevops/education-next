import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  school: { findFirst: vi.fn() },
  level: { findMany: vi.fn() },
  period: { findMany: vi.fn() },
  classPeriod: { findMany: vi.fn() },
  plan: { findMany: vi.fn() },
  teacher: { findMany: vi.fn() },
  event: { findMany: vi.fn(), findUnique: vi.fn() },
  classScheduleSlot: { findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy.
// Même motif que `class-period-gateway.test.ts` et `school-gateway.test.ts`.
const { mcpReadGateway } = await import('../mcp-read-gateway')

const SCHOOL = 'school-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('mcpReadGateway', () => {
  it('publishes the school by identity alone', async () => {
    await mcpReadGateway.describeSchool(SCHOOL)

    expect(dbMock.school.findFirst).toHaveBeenCalledWith({
      // `School` n'est pas couvert par le soft-delete de `src/lib/db.ts` : le filtre est explicite.
      where: { id: SCHOOL, isActive: true },
      select: { id: true, name: true, slug: true },
    })
  })

  it('publishes levels with their next level named, not the whole row', async () => {
    await mcpReadGateway.listLevels(SCHOOL)

    expect(dbMock.level.findMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, isActive: true },
      select: { id: true, name: true, nextLevel: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    })
  })

  it('publishes periods with their span, most recent first', async () => {
    await mcpReadGateway.listPeriods(SCHOOL)

    expect(dbMock.period.findMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, isActive: true },
      select: { id: true, name: true, startAt: true, endAt: true },
      orderBy: { startAt: 'desc' },
    })
  })

  it('publishes classes with level, period and teachers named, and skips archived teachers', async () => {
    await mcpReadGateway.listClassPeriods(SCHOOL)

    expect(dbMock.classPeriod.findMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, isActive: true },
      select: {
        id: true,
        name: true,
        capacity: true,
        level: { select: { id: true, name: true } },
        period: { select: { id: true, name: true } },
        teachers: {
          // L'extension soft-delete ne filtre que la racine de la requête : une relation
          // imbriquée qui ne pose pas `isActive` publie les lignes archivées.
          where: { teacher: { isActive: true } },
          select: { teacher: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { name: 'asc' },
    })
  })

  it('publishes plans with their amount, excluding the reserved unpriced plan from the catalog', async () => {
    await mcpReadGateway.listPlans(SCHOOL)

    expect(dbMock.plan.findMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, isActive: true, name: { not: '__unpriced__' } },
      select: { id: true, name: true, amount: true },
      orderBy: { name: 'asc' },
    })
  })

  it('publishes teachers by identity alone', async () => {
    await mcpReadGateway.listTeachers(SCHOOL)

    expect(dbMock.teacher.findMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
  })

  const eventSummary = {
    id: true,
    slug: true,
    title: true,
    category: true,
    visibility: true,
    status: true,
    allDay: true,
    startAt: true,
    endAt: true,
    location: true,
  }

  it('lists events by their start, bounded, without images or school id', async () => {
    const from = new Date('2026-12-01T00:00:00.000Z')
    const before = new Date('2027-01-01T00:00:00.000Z')

    await mcpReadGateway.listEvents(SCHOOL, { from, before, status: 'DRAFT', take: 11 })

    expect(dbMock.event.findMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, status: 'DRAFT', startAt: { gte: from, lt: before } },
      select: eventSummary,
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      take: 11,
    })
  })

  it('lists every status and date when no filter is given', async () => {
    await mcpReadGateway.listEvents(SCHOOL, { take: 51 })

    expect(dbMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: SCHOOL }, take: 51 })
    )
  })

  it('reads one event of the school with its texts, never its images', async () => {
    await mcpReadGateway.getEvent(SCHOOL, 'event-1')

    expect(dbMock.event.findUnique).toHaveBeenCalledWith({
      where: { id_schoolId: { id: 'event-1', schoolId: SCHOOL } },
      select: { ...eventSummary, summary: true, description: true, announceDaysBefore: true },
    })
  })

  it('publishes only active-class schedule fields within the key school and selected period', async () => {
    await mcpReadGateway.listClassScheduleSlots(SCHOOL, 'period-1')

    expect(dbMock.classScheduleSlot.findMany).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, classPeriod: { periodId: 'period-1', isActive: true } },
      select: {
        id: true,
        weekday: true,
        startTime: true,
        endTime: true,
        description: true,
        classPeriod: { select: { id: true, name: true } },
        teachers: {
          where: { teacher: { isActive: true } },
          select: { teacher: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    })
  })
})
