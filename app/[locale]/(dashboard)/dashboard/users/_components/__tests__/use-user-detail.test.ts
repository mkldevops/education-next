import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../_lib/user-actions', () => ({
  getUserDetailAction: vi.fn(),
}))

import { getUserDetailAction } from '../../../../_lib/user-actions'
import { useUserDetail } from '../use-user-detail'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useUserDetail', () => {
  it('sets an error and clears detail when the fetch rejects, without an unhandled rejection', async () => {
    vi.mocked(getUserDetailAction).mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useUserDetail('user-1', true))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.detail).toBeNull()
  })

  it('clears a previous error once the target user changes and the fetch succeeds', async () => {
    vi.mocked(getUserDetailAction).mockRejectedValueOnce(new Error('network error'))

    const { result, rerender } = renderHook(({ userId }) => useUserDetail(userId, true), {
      initialProps: { userId: 'user-1' },
    })

    await waitFor(() => expect(result.current.error).toBe(true))

    vi.mocked(getUserDetailAction).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture for the discriminated detail shape
      { id: 'user-2' } as any
    )
    rerender({ userId: 'user-2' })

    await waitFor(() => expect(result.current.error).toBe(false))
  })
})
