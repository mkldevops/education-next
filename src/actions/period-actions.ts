'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'
import { SELECTED_PERIOD_COOKIE } from '@/features/dashboard/period'

const SELECTED_PERIOD_MAX_AGE_S = 60 * 60 * 24 * 30

export async function setSelectedPeriod(periodId: string) {
  const parsed = z.uuid().safeParse(periodId)
  if (!parsed.success) return 'invalidPeriodId' as const

  const cookieStore = await cookies()
  cookieStore.set(SELECTED_PERIOD_COOKIE, parsed.data, {
    path: '/',
    maxAge: SELECTED_PERIOD_MAX_AGE_S,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
  return 'OK' as const
}
