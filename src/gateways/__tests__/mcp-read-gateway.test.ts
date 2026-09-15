import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  school: { findFirst: vi.fn() },
  level: { findMany: vi.fn() },
  period: { findMany: vi.fn() },
  classPeriod: { findMany: vi.fn() },
  plan: { findMany: vi.fn() },
  teacher: { findMany: vi.fn() },
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
})
