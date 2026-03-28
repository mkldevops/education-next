'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'

export async function setSelectedPeriod(periodId: string) {
  const parsed = z.uuid().safeParse(periodId)
  if (!parsed.success) return 'invalidPeriodId' as const

  const cookieStore = await cookies()
  cookieStore.set('selected_period', parsed.data, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
  return 'OK' as const
}
