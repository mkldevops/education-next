import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  mcpApiKey: {
    count: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy.
// Même motif que `school-gateway.test.ts`.
const { mcpApiKeyGateway } = await import('../mcp-api-key-gateway')

const tx = {
  mcpApiKey: { count: vi.fn(), create: vi.fn() },
}

const now = new Date('2026-09-12T10:00:00.000Z')

const data = {
  schoolId: 'school-1',
  userId: 'user-1',
  name: 'Poste de Fatima',
  prefix: 'edu_mcp_ABCD',
  keyHash: 'sha256',
  expiresAt: new Date('2026-12-11T10:00:00.000Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  tx.mcpApiKey.count.mockResolvedValue(0)
  tx.mcpApiKey.create.mockImplementation(async (args: { data: unknown }) => ({
    id: 'key-1',
    ...(args.data as object),
  }))
  dbMock.$transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
})

describe('mcpApiKeyGateway.createWithinLimit', () => {
  it('counts and inserts inside one Serializable transaction', async () => {
    await mcpApiKeyGateway.createWithinLimit(data, { now, maxLive: 5 })

    expect(dbMock.$transaction).toHaveBeenCalledTimes(1)
    expect(dbMock.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' })

    // Le comptage comme l'insertion passent par le client transactionnel : un seul des
    // deux hors transaction rendrait le plafond franchissable.
    expect(tx.mcpApiKey.count).toHaveBeenCalledTimes(1)
    expect(tx.mcpApiKey.create).toHaveBeenCalledTimes(1)
    expect(dbMock.mcpApiKey.count).not.toHaveBeenCalled()
    expect(dbMock.mcpApiKey.create).not.toHaveBeenCalled()
  })

  it('refuses without inserting once the holder carries the maximum', async () => {
    tx.mcpApiKey.count.mockResolvedValue(5)

    expect(await mcpApiKeyGateway.createWithinLimit(data, { now, maxLive: 5 })).toBe('tooManyKeys')
    expect(tx.mcpApiKey.create).not.toHaveBeenCalled()
  })

  it('counts only the keys still usable by that holder on that school', async () => {
    await mcpApiKeyGateway.createWithinLimit(data, { now, maxLive: 5 })

    expect(tx.mcpApiKey.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        schoolId: 'school-1',
        revokedAt: null,
        expiresAt: { gt: now },
      },
    })
  })

  it('returns the created row without its hash', async () => {
    const created = await mcpApiKeyGateway.createWithinLimit(data, { now, maxLive: 5 })
    if (created === 'tooManyKeys') throw new Error('expected a row')

    expect(tx.mcpApiKey.create.mock.calls[0][0].select).toMatchObject({ prefix: true })
    expect(tx.mcpApiKey.create.mock.calls[0][0].select).not.toHaveProperty('keyHash')
  })
})
