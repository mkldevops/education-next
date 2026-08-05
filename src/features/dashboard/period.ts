import { cookies } from 'next/headers'
import { z } from 'zod'
import { selectDefaultPeriod } from '@/domain/period'
import { db } from '@/lib/db'

export type SelectedPeriod = {
  id: string
  name: string
}

export async function getSelectedPeriod(): Promise<SelectedPeriod | null> {
  const raw = (await cookies()).get('selected_period')?.value
  const parsed = z.uuid().safeParse(raw)

  if (parsed.success) {
    const period = await db.period.findFirst({
      where: { id: parsed.data, isActive: true },
      select: { id: true, name: true },
    })
    if (period) return period
  }

  const periods = await db.period.findMany({
    where: { isActive: true },
    orderBy: { startAt: 'desc' },
    select: {
      id: true,
      name: true,
      startAt: true,
      endAt: true,
      _count: { select: { classPeriods: { where: { isActive: true } } } },
    },
  })

  const candidates = periods.map((period) => ({
    id: period.id,
    name: period.name,
    startAt: period.startAt,
    endAt: period.endAt,
    hasClasses: period._count.classPeriods > 0,
  }))

  const selected = selectDefaultPeriod(candidates, new Date())
  return selected ? { id: selected.id, name: selected.name } : null
}

export async function getSelectedPeriodId(): Promise<string | null> {
  return (await getSelectedPeriod())?.id ?? null
}
