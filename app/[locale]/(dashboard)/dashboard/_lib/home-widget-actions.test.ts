import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const updateMock = vi.fn()
const findUniqueMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: getSessionMock } } }))
vi.mock('@/lib/db', () => ({ db: { user: { update: updateMock, findUnique: findUniqueMock } } }))

const { saveCollectionChartViewAction, saveHiddenWidgetsAction, setWidgetHiddenAction } =
  await import('./home-widget-actions')

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

describe('setWidgetHiddenAction', () => {
  it('adds one block to the hidden list without duplicates', async () => {
    findUniqueMock.mockResolvedValue({ dashboardHiddenWidgets: ['events'] })

    expect(await setWidgetHiddenAction({ widget: 'events', hidden: true })).toBe('OK')
    expect(await setWidgetHiddenAction({ widget: 'tasks', hidden: true })).toBe('OK')

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { dashboardHiddenWidgets: true },
    })
    expect(updateMock.mock.calls.map(([call]) => call.data.dashboardHiddenWidgets)).toEqual([
      ['events'],
      ['events', 'tasks'],
    ])
  })

  it('shows a block again for undo', async () => {
    findUniqueMock.mockResolvedValue({ dashboardHiddenWidgets: ['events', 'tasks'] })

    expect(await setWidgetHiddenAction({ widget: 'events', hidden: false })).toBe('OK')
    expect(updateMock.mock.calls[0][0].data.dashboardHiddenWidgets).toEqual(['tasks'])
  })

  it('rejects an unknown block and refuses impersonation before any read', async () => {
    expect(await setWidgetHiddenAction({ widget: 'secret', hidden: true })).toBe('validationError')

    getSessionMock.mockResolvedValue({ user: { id: 'user-1' }, session: { impersonatedBy: 'a' } })
    expect(await setWidgetHiddenAction({ widget: 'tasks', hidden: true })).toBe('impersonating')

    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('saveCollectionChartViewAction', () => {
  it('stores the chart view on the signed-in user', async () => {
    expect(await saveCollectionChartViewAction({ granularity: 'day', range: '30d' })).toBe('OK')

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { dashboardChartGranularity: 'day', dashboardChartRange: '30d' },
      select: { id: true },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/[locale]/dashboard', 'page')
    expect(revalidatePathMock).toHaveBeenCalledWith('/[locale]/dashboard/payments', 'page')
  })

  it('rejects an unknown value or an unreadable pair before any write', async () => {
    expect(await saveCollectionChartViewAction({ granularity: 'week', range: '30d' })).toBe(
      'validationError'
    )
    expect(await saveCollectionChartViewAction({ granularity: 'day', range: '12m' })).toBe(
      'validationError'
    )
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('leaves the impersonated user preferences untouched', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user-1' }, session: { impersonatedBy: 'a' } })

    expect(await saveCollectionChartViewAction({ granularity: 'day', range: '7d' })).toBe(
      'impersonating'
    )
    expect(updateMock).not.toHaveBeenCalled()
  })
})
