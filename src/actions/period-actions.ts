'use server'

import { cookies } from 'next/headers'

export async function setSelectedPeriod(periodId: string) {
  const cookieStore = await cookies()
  cookieStore.set('selected_period', periodId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: false,
    sameSite: 'lax',
  })
  return 'OK' as const
}
