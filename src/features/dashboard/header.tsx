import type { ReactNode } from 'react'
import { db } from '@/lib/db'
import { getSchoolContext } from '@/lib/school-context'
import { DashboardHeaderClient } from './header-client'
import { getSelectedPeriodId } from './period'

/** `news` : entrée « Nouveautés », fournie par la route pour garder ses lectures hors de `features`. */
export async function DashboardHeader({ news }: { news?: ReactNode } = {}) {
  const context = await getSchoolContext()

  // Le sélecteur de période est vide hors école active — un super-admin sans
  // aucune école dans le réseau, par exemple. Le reste de l'en-tête reste utile.
  if (!context) {
    return <DashboardHeaderClient periods={[]} selectedPeriodId={null} news={news} />
  }

  const [periods, selectedPeriodId] = await Promise.all([
    db.period.findMany({
      where: { schoolId: context.schoolId, isActive: true },
      select: { id: true, name: true, startAt: true, endAt: true },
      orderBy: { startAt: 'desc' },
    }),
    getSelectedPeriodId(context.schoolId),
  ])

  return <DashboardHeaderClient periods={periods} selectedPeriodId={selectedPeriodId} news={news} />
}
