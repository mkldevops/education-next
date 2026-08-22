import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  config: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy.
// Un import statique du module testé l'évaluerait avant l'affectation de
// `dbMock`, qui serait alors dans sa zone morte. Même motif que
// `session-gateway.test.ts`.
const { configGateway } = await import('../config-gateway')

const SCHOOL = 'school-1'
const DATA = { name: 'theme_primary', value: '#000', valueType: 'COLOR' } as const

beforeEach(() => {
  vi.clearAllMocks()
})

describe('configGateway.set', () => {
  /**
   * `@@unique([schoolId, name])` est un index **partiel** (`WHERE isActive = true`).
   * Prisma émet le sélecteur `schoolId_name` sans ce prédicat, donc une ligne
   * archivée homonyme fait correspondre deux lignes et la requête échoue avec
   * « Expected zero or one element, got 2 » — vérifié contre PostgreSQL 18.
   * La ligne à écrire est déjà résolue par `findFirst` : on la met à jour par sa
   * clé primaire.
   */
  it('updates by primary key, never by the partial unique selector', async () => {
    dbMock.config.findFirst.mockResolvedValue({ id: 'config-1' })

    await configGateway.set(SCHOOL, DATA)

    expect(dbMock.config.update).toHaveBeenCalledWith({
      where: { id: 'config-1', schoolId: SCHOOL },
      data: { value: DATA.value, valueType: DATA.valueType },
    })
    expect(dbMock.config.create).not.toHaveBeenCalled()
  })

  it('keeps schoolId in the update filter so the tenant guard accepts it', async () => {
    dbMock.config.findFirst.mockResolvedValue({ id: 'config-1' })

    await configGateway.set(SCHOOL, DATA)

    const { where } = dbMock.config.update.mock.calls[0][0]
    expect(where).toHaveProperty('schoolId', SCHOOL)
  })

  it('creates a scoped row when none is active', async () => {
    dbMock.config.findFirst.mockResolvedValue(null)

    await configGateway.set(SCHOOL, DATA)

    expect(dbMock.config.create).toHaveBeenCalledWith({ data: { ...DATA, schoolId: SCHOOL } })
    expect(dbMock.config.update).not.toHaveBeenCalled()
  })

  it('looks the row up scoped by school, and only among active ones', async () => {
    dbMock.config.findFirst.mockResolvedValue(null)

    await configGateway.set(SCHOOL, DATA)

    // `isActive` n'est pas écrit ici : l'extension de soft-delete le force sur
    // `findFirst`. Ce qui doit être explicite, c'est l'école.
    expect(dbMock.config.findFirst).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, name: DATA.name },
      select: { id: true },
    })
  })
})

describe('configGateway.get', () => {
  it('constrains schoolId, which the tenant guard requires', async () => {
    dbMock.config.findFirst.mockResolvedValue(null)

    await configGateway.get(SCHOOL, 'max_students_per_class')

    expect(dbMock.config.findFirst).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL, name: 'max_students_per_class' },
    })
  })
})
