import { cookies } from 'next/headers'
import { z } from 'zod'
import { selectDefaultPeriod } from '@/domain/period'
import { db } from '@/lib/db'

export type SelectedPeriod = {
  id: string
  name: string
}

/**
 * Période sélectionnée pour une école.
 *
 * `schoolId` est requis et non déduit du cookie : la valeur de `selected_period`
 * survit à une bascule d'école, donc l'existence de la période ne suffit pas — il
 * faut vérifier son **appartenance**, sinon une période de l'école A filtrerait
 * les données de l'école B. Un cookie pointant ailleurs est traité comme absent.
 */
export async function getSelectedPeriod(schoolId: string): Promise<SelectedPeriod | null> {
  const raw = (await cookies()).get('selected_period')?.value
  const parsed = z.uuid().safeParse(raw)

  if (parsed.success) {
    const period = await db.period.findFirst({
      where: { id: parsed.data, schoolId, isActive: true },
      select: { id: true, name: true },
    })
    if (period) return period
  }

  const periods = await db.period.findMany({
    where: { schoolId, isActive: true },
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

export async function getSelectedPeriodId(schoolId: string): Promise<string | null> {
  return (await getSelectedPeriod(schoolId))?.id ?? null
}
