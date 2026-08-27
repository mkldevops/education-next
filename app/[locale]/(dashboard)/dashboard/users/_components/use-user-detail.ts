'use client'

import { useCallback, useEffect, useState } from 'react'
import { getUserDetailAction } from '../../../_lib/user-actions'

export type UserDetail = NonNullable<Awaited<ReturnType<typeof getUserDetailAction>>>

export function useUserDetail(userId: string | null, open: boolean) {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !userId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoading(true)
    getUserDetailAction(userId)
      .then((result) => {
        if (!cancelled) setDetail(result)
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
    setDetail(await getUserDetailAction(userId))
  }, [userId])

  return { detail, loading, refresh }
}
