import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const updateMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: getSessionMock } } }))
vi.mock('@/lib/db', () => ({ db: { user: { update: updateMock } } }))

const { saveHiddenWidgetsAction } = await import('./home-widget-actions')

beforeEach(() => {
  vi.clearAllMocks()
  getSessionMock.mockResolvedValue({ user: { id: 'user-1' }, session: {} })
})

describe('saveHiddenWidgetsAction', () => {
  it('stores the hidden blocks on the signed-in user only', async () => {
    const result = await saveHiddenWidgetsAction(['events', 'tasks', 'events'])

    expect(result).toBe('OK')
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { dashboardHiddenWidgets: ['events', 'tasks'] },
      select: { id: true },
    })
    expect(revalidatePathMock).toHaveBeenCalled()
  })

  it('rejects an unknown block before any write', async () => {
    expect(await saveHiddenWidgetsAction(['tasks', 'secret'])).toBe('validationError')
    expect(await saveHiddenWidgetsAction('tasks')).toBe('validationError')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('refuses without a session', async () => {
    getSessionMock.mockResolvedValue(null)

    expect(await saveHiddenWidgetsAction([])).toBe('unauthorized')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('leaves the impersonated user preferences untouched', async () => {
    getSessionMock.mockResolvedValue({
      user: { id: 'user-1' },
      session: { impersonatedBy: 'admin-1' },
    })

    expect(await saveHiddenWidgetsAction([])).toBe('impersonating')
    expect(updateMock).not.toHaveBeenCalled()
  })
})
