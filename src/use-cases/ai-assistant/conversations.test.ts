import { describe, expect, it, vi } from 'vitest'

vi.mock('@/gateways/ai-conversation-gateway', () => ({ aiConversationGateway: {} }))

const { deleteConversation, listConversations, loadConversation } = await import('./conversations')

const scope = { schoolId: 'school-1', userId: 'user-1' }
const id = '11111111-1111-4111-8111-111111111111'

describe('conversations', () => {
  it('lists the latest conversations of this administrator in this school', async () => {
    const list = vi
      .fn()
      .mockResolvedValue([{ id, title: 'Paiement', updatedAt: new Date('2026-09-27T08:00:00Z') }])

    expect(await listConversations(scope, { list } as never)).toEqual([
      { id, title: 'Paiement', updatedAt: '2026-09-27T08:00:00.000Z' },
    ])
    expect(list).toHaveBeenCalledWith('school-1', 'user-1', 30)
  })

  it("answers notFound for someone else's or a malformed conversation", async () => {
    const find = vi.fn().mockResolvedValue(null)

    expect(await loadConversation(scope, id, { find } as never)).toBe('notFound')
    expect(await loadConversation(scope, 'nope', { find } as never)).toBe('notFound')
    expect(find).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledWith('school-1', 'user-1', id)
  })

  it('loads the stored messages', async () => {
    const find = vi.fn().mockResolvedValue({ id, title: 't', messages: [{ id: 'a' }] })

    expect(await loadConversation(scope, id, { find } as never)).toEqual({
      id,
      messages: [{ id: 'a' }],
    })
  })

  it('deletes only within the scope', async () => {
    const remove = vi.fn().mockResolvedValue({ count: 0 })

    expect(await deleteConversation(scope, id, { delete: remove } as never)).toBe('notFound')
    expect(remove).toHaveBeenCalledWith('school-1', 'user-1', id)
  })
})
