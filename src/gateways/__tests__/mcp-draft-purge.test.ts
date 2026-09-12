// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { committedRetentionBefore } from '@/domain/mcp-draft'
import { mcpDraftGateway } from '@/gateways/mcp-draft-gateway'
import { db } from '@/lib/db'

/**
 * Purge sur une vraie base, parce qu'un mock ne prouverait rien ici.
 *
 * Ce que la purge doit garantir n'est pas la forme de la requête mais son résultat : un brouillon
 * jamais validé disparaît, un résultat de rejeu survit sa semaine, et le garde tenant — qui refuse
 * un `deleteMany` non scopé sur `db` — laisse malgré tout passer l'entretien.
 */

const databaseUrl = process.env.DATABASE_URL

const now = new Date()
const day = 24 * 60 * 60 * 1000

let schoolId = ''

it("n'est jamais ignoré silencieusement en intégration continue", () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('mcpDraftGateway.purgeExpired', () => {
  async function seedDraft(
    keyId: string,
    status: 'PENDING' | 'COMMITTED',
    expiresAt: Date,
    committedAt: Date | null
  ) {
    const draft = await db.mcpDraft.create({
      data: {
        schoolId,
        keyId,
        tool: 'record_payment',
        checksum: 'abcdef012345',
        resolved: {},
        status,
        expiresAt,
        committedAt,
      },
      select: { id: true },
    })
    return draft.id
  }

  beforeAll(async () => {
    const school = await db.school.create({
      data: { name: 'draft purge', slug: `draft-purge-${Date.now()}` },
    })
    schoolId = school.id
  })

  afterAll(async () => {
    if (schoolId) await db.school.delete({ where: { id: schoolId } })
  })

  it('deletes what is out of use and keeps what a replay may still need', async () => {
    const expiredPending = await seedDraft('a', 'PENDING', new Date(now.getTime() - 60_000), null)
    const livePending = await seedDraft('b', 'PENDING', new Date(now.getTime() + 60_000), null)
    const freshResult = await seedDraft(
      'c',
      'COMMITTED',
      new Date(now.getTime() - day),
      new Date(now.getTime() - day)
    )
    const staleResult = await seedDraft(
      'd',
      'COMMITTED',
      new Date(now.getTime() - 8 * day),
      new Date(now.getTime() - 8 * day)
    )

    await mcpDraftGateway.purgeExpired(now, committedRetentionBefore(now))

    const remaining = await db.mcpDraft.findMany({ where: { schoolId }, select: { id: true } })
    const ids = remaining.map((row) => row.id)

    expect(ids).toContain(livePending)
    expect(ids).toContain(freshResult)
    expect(ids).not.toContain(expiredPending)
    expect(ids).not.toContain(staleResult)
  })
})
