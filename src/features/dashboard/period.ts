import { cookies } from 'next/headers'
import { z } from 'zod'
import { db } from '@/lib/db'

export async function getSelectedPeriodId(): Promise<string | null> {
  const raw = (await cookies()).get('selected_period')?.value
  const parsed = z.uuid().safeParse(raw)

  if (parsed.success) {
    const period = await db.period.findFirst({
      where: { id: parsed.data, isActive: true },
      select: { id: true },
    })
    if (period) return period.id
  }

  const latest = await db.period.findFirst({
    where: { isActive: true },
    orderBy: { startAt: 'desc' },
    select: { id: true },
  })
  return latest?.id ?? null
}
