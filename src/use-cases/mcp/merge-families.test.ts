import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MCP_DRAFT_CHECKSUM_LENGTH } from '@/domain/mcp-draft'
import type { DraftScope } from './draft-scope'

const schoolId = 'school-1'
const sourceId = '550e8400-e29b-41d4-a716-446655440001'
const targetId = '550e8400-e29b-41d4-a716-446655440002'
const draftId = '550e8400-e29b-41d4-a716-446655440003'
const scope: DraftScope = {
  schoolId,
  userId: 'admin',
  paymentsEnabled: false,
  owner: { kind: 'MCP_KEY', keyId: 'key-1' },
}
const input = { sourceId, targetId }
const makeFamily = (id: string, name: string) => ({
  id,
  name,
  isActive: true,
  emergencyContactName: null,
  emergencyContactPhone: null,
  authorizedPickup: null,
  languagesAtHome: [],
  updatedAt: new Date('2026-11-02T00:00:00Z'),
  persons: [
    {
      personId: `${id}-person`,
      relationType: 'OTHER',
      person: {
        name: 'Child',
        lastname: name,
        isActive: true,
        student: { id: `${id}-student`, isActive: true },
      },
    },
  ],
  users: [] as Array<{ userId: string; user: { name: string } }>,
  invitations: [],
  _count: { payments: 0, receipts: 0, paymentTransactions: 0 },
})
let families = [makeFamily(sourceId, 'Source'), makeFamily(targetId, 'Target')]
let draft: Record<string, unknown> | null = null
const createDraft = vi.fn()
const claimDraft = vi.fn()
const findDraft = vi.fn()
const releaseDraft = vi.fn()
const tx = {
  $queryRaw: vi.fn(),
  family: { findMany: vi.fn(), update: vi.fn() },
  familyPerson: { findMany: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  userFamily: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  paymentTransaction: { count: vi.fn(), updateMany: vi.fn() },
  payment: { updateMany: vi.fn() },
  receipt: { updateMany: vi.fn() },
  invitation: { updateMany: vi.fn() },
  mcpDraft: { updateMany: vi.fn() },
}
const transaction = vi.fn(async (body: (client: typeof tx) => unknown) => body(tx))
const nestedTransaction = vi.fn()
const checkoutLock = vi.fn()
vi.mock('@/lib/db', () => ({
  db: { $transaction: transaction },
  dbArchived: { ...tx, $transaction: nestedTransaction },
}))
vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: { tryLockFamilyCheckout: checkoutLock },
}))
vi.mock('@/gateways/mcp-draft-gateway', () => ({
  mcpDraftGateway: {
    create: createDraft,
    claim: claimDraft,
    findById: findDraft,
    release: releaseDraft,
  },
}))
const { previewMergeFamilies } = await import('./preview-merge-families')
const { commitMergeFamilies } = await import('./commit-merge-families')

beforeEach(() => {
  vi.clearAllMocks()
  families = [makeFamily(sourceId, 'Source'), makeFamily(targetId, 'Target')]
  draft = null
  checkoutLock.mockResolvedValue(true)
  tx.family.findMany.mockImplementation(async ({ where }) =>
    where.schoolId === schoolId ? families.filter((family) => family.isActive) : []
  )
  tx.family.update.mockImplementation(async ({ where, data }) => {
    Object.assign(families.find((family) => family.id === where.id_schoolId.id) ?? {}, data)
  })
  tx.familyPerson.findMany.mockImplementation(async () =>
    families.flatMap((family) =>
      family.persons.map((link) => ({
        familyId: family.id,
        personId: link.personId,
        relationType: link.relationType,
      }))
    )
  )
  tx.familyPerson.findFirst.mockResolvedValue(null)
  tx.userFamily.findMany.mockResolvedValue([])
  tx.paymentTransaction.count.mockResolvedValue(0)
  createDraft.mockImplementation(async (_schoolId, data) => {
    draft = {
      id: draftId,
      schoolId,
      ...data,
      ownerKind: 'MCP_KEY',
      keyId: 'key-1',
      userId: null,
      grantId: null,
      status: 'PENDING',
      result: null,
    }
    return { id: draftId }
  })
  claimDraft.mockImplementation(async (id, owner, _draftId, tool, checksum, now) => {
    if (
      !draft ||
      id !== schoolId ||
      owner.kind !== 'MCP_KEY' ||
      owner.keyId !== 'key-1' ||
      draft.tool !== tool ||
      draft.checksum !== checksum ||
      draft.status !== 'PENDING' ||
      (draft.expiresAt as Date) <= now
    )
      return { count: 0 }
    draft.status = 'COMMITTED'
    return { count: 1 }
  })
  findDraft.mockImplementation(async (id) => (id === schoolId ? draft : null))
  releaseDraft.mockImplementation(async () => {
    if (draft) draft.status = 'PENDING'
  })
  tx.mcpDraft.updateMany.mockImplementation(async ({ data }) => {
    if (draft) draft.result = data.result
  })
})

async function preview() {
  const result = await previewMergeFamilies(scope, input)
  if (typeof result === 'string' || !result.draftId || !result.checksum)
    throw new Error('Expected a valid preview')
  return { draftId: result.draftId, checksum: result.checksum }
}

describe('MCP family merge', () => {
  it('previews members and combined access without mutating families, even without payments', async () => {
    const result = await previewMergeFamilies(scope, input)
    expect(result).toMatchObject({
      draftId,
      plan: {
        source: { id: sourceId, members: [{ name: 'Child', lastname: 'Source' }] },
        target: { id: targetId },
        effects: { parentAccessCombined: true, sourceArchived: true },
      },
      warnings: [{ reason: 'expandedFamilyAccess' }],
      blockers: [],
    })
    expect(createDraft).toHaveBeenCalledWith(
      schoolId,
      expect.objectContaining({ owner: scope.owner, tool: 'merge_families' })
    )
    expect(tx.family.update).not.toHaveBeenCalled()
    expect(tx.payment.updateMany).not.toHaveBeenCalled()
  })
  it('does not create a draft for foreign-school families or blocked merges', async () => {
    expect(await previewMergeFamilies({ ...scope, schoolId: 'other-school' }, input)).toMatchObject(
      { draftId: null, blockers: [{ reason: 'notFound' }] }
    )
    tx.paymentTransaction.count.mockResolvedValue(1)
    expect(await previewMergeFamilies(scope, input)).toMatchObject({
      draftId: null,
      blockers: [{ reason: 'pendingPayment' }],
    })
    expect(createDraft).not.toHaveBeenCalled()
  })
  it('rejects invalid and self targets', async () => {
    expect(await previewMergeFamilies(scope, { ...input, sourceId: 'bad' })).toBe('validationError')
    expect(await previewMergeFamilies(scope, { sourceId, targetId: sourceId })).toBe('sameFamily')
    expect(createDraft).not.toHaveBeenCalled()
  })
  it('merges and stores its replay result in the same Read Committed transaction', async () => {
    const confirmation = await preview()
    const result = await commitMergeFamilies(scope, confirmation)
    expect(result).toEqual({ sourceId, targetId, sourceArchived: true, merged: true })
    expect(tx.mcpDraft.updateMany).toHaveBeenCalledWith({
      where: { id: draftId, schoolId },
      data: { result },
    })
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
    })
    expect(nestedTransaction).not.toHaveBeenCalled()
    expect(families[0].isActive).toBe(false)
  })
  it('returns the stored result when replayed, without merging an archived source again', async () => {
    const confirmation = await preview()
    const first = await commitMergeFamilies(scope, confirmation)
    const writes = tx.family.update.mock.calls.length
    expect(await commitMergeFamilies(scope, confirmation)).toEqual(first)
    expect(tx.family.update).toHaveBeenCalledTimes(writes)
    expect(transaction).toHaveBeenCalledTimes(1)
  })
  it.each(['account', 'member', 'name', 'history'])(
    'refuses stale %s information before writing and releases the draft',
    async (change) => {
      const confirmation = await preview()
      if (change === 'account')
        families[0].users.push({ userId: 'new-parent', user: { name: 'Parent' } })
      if (change === 'member') families[0].persons[0].person.name = 'Changed'
      if (change === 'name') families[0].name = 'Changed family'
      if (change === 'history') families[0]._count.payments++
      expect(await commitMergeFamilies(scope, confirmation)).toBe('staleDraft')
      expect(tx.family.update).not.toHaveBeenCalled()
      expect(tx.payment.updateMany).not.toHaveBeenCalled()
      expect(tx.mcpDraft.updateMany).not.toHaveBeenCalled()
      expect(releaseDraft).toHaveBeenCalledWith(schoolId, draftId)
    }
  )
  it('rejects another owner, another school, wrong checksum and expired drafts', async () => {
    const confirmation = await preview()
    expect(
      await commitMergeFamilies(
        { ...scope, owner: { kind: 'MCP_KEY', keyId: 'other-key' } },
        confirmation
      )
    ).toBe('draftNotFound')
    expect(await commitMergeFamilies({ ...scope, schoolId: 'other-school' }, confirmation)).toBe(
      'draftNotFound'
    )
    expect(
      await commitMergeFamilies(scope, {
        ...confirmation,
        checksum: '0'.repeat(MCP_DRAFT_CHECKSUM_LENGTH),
      })
    ).toBe('checksumMismatch')
    if (draft) draft.expiresAt = new Date(0)
    expect(await commitMergeFamilies(scope, confirmation)).toBe('draftExpired')
    expect(transaction).not.toHaveBeenCalled()
  })
})
