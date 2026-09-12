import { beforeEach, describe, expect, it, vi } from 'vitest'
import { committedRetentionBefore, MCP_DRAFT_PURGE_INTERVAL_MINUTES } from '@/domain/mcp-draft'

const purgeExpired = vi.fn()

vi.mock('@/gateways/mcp-draft-gateway', () => ({
  mcpDraftGateway: { purgeExpired },
}))

// `lastPurgeAt` est un état de module : sans réinitialisation, chaque cas hériterait de
// l'étranglement du précédent et l'ordre du fichier deviendrait significatif.
let purgeExpiredDrafts: typeof import('./purge-expired-drafts').purgeExpiredDrafts

const now = new Date('2026-09-12T10:00:00.000Z')
const intervalMs = MCP_DRAFT_PURGE_INTERVAL_MINUTES * 60 * 1000

beforeEach(async () => {
  vi.clearAllMocks()
  purgeExpired.mockResolvedValue(3)
  vi.resetModules()
  ;({ purgeExpiredDrafts } = await import('./purge-expired-drafts'))
})

describe('purgeExpiredDrafts', () => {
  it('purges on the first pass and reports what it deleted', async () => {
    expect(await purgeExpiredDrafts(now)).toBe(3)
    expect(purgeExpired).toHaveBeenCalledWith(now, committedRetentionBefore(now))
  })

  it('skips a second pass inside the interval, without touching the database', async () => {
    await purgeExpiredDrafts(now)
    purgeExpired.mockClear()

    expect(await purgeExpiredDrafts(new Date(now.getTime() + intervalMs - 1))).toBe('skipped')
    expect(purgeExpired).not.toHaveBeenCalled()
  })

  it('purges again once the interval has elapsed', async () => {
    await purgeExpiredDrafts(now)
    purgeExpired.mockClear()

    const next = new Date(now.getTime() + intervalMs)
    expect(await purgeExpiredDrafts(next)).toBe(3)
    expect(purgeExpired).toHaveBeenCalledWith(next, committedRetentionBefore(next))
  })
})
