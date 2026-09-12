import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = { $transaction: vi.fn() }

vi.mock('@/lib/db', () => ({ db: dbMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy.
// Même motif que `school-gateway.test.ts`.
const { inSerializableTransaction } = await import('../serializable-transaction')

const abort = (code: string) => Object.assign(new Error(code), { code })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('inSerializableTransaction', () => {
  it('runs the work under Serializable and returns its verdict', async () => {
    dbMock.$transaction.mockImplementation(async (run: (tx: unknown) => unknown) => run('tx'))

    expect(await inSerializableTransaction(async (tx) => tx)).toBe('tx')
    expect(dbMock.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' })
  })

  it('replays once when PostgreSQL aborts the transaction', async () => {
    dbMock.$transaction
      .mockRejectedValueOnce(abort('P2034'))
      .mockResolvedValueOnce('second attempt')

    expect(await inSerializableTransaction(async () => 'unused')).toBe('second attempt')
    expect(dbMock.$transaction).toHaveBeenCalledTimes(2)
  })

  it('lets a second abort reach the caller instead of replaying again', async () => {
    dbMock.$transaction.mockRejectedValue(abort('P2034'))

    await expect(inSerializableTransaction(async () => 'unused')).rejects.toMatchObject({
      code: 'P2034',
    })
    expect(dbMock.$transaction).toHaveBeenCalledTimes(2)
  })

  it('never replays a failure that is not a serialization abort', async () => {
    dbMock.$transaction.mockRejectedValue(abort('P2002'))

    await expect(inSerializableTransaction(async () => 'unused')).rejects.toMatchObject({
      code: 'P2002',
    })
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1)
  })
})
