'use client'

import { useCallback, useEffect, useState } from 'react'
import { getUserDetailAction } from '../../../_lib/user-actions'

export type UserDetail = NonNullable<Awaited<ReturnType<typeof getUserDetailAction>>>

export function useUserDetail(userId: string | null, open: boolean) {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || !userId) {
      setDetail(null)
      setError(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    getUserDetailAction(userId)
      .then((result) => {
        if (!cancelled) setDetail(result)
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null)
          setError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, userId])

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      setDetail(await getUserDetailAction(userId))
      setError(false)
    } catch {
      setError(true)
    }
  }, [userId])

  return { detail, loading, error, refresh }
}
