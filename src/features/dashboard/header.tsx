import { db } from '@/lib/db'
import { DashboardHeaderClient } from './header-client'
import { getSelectedPeriodId } from './period'

export async function DashboardHeader() {
  const [periods, selectedPeriodId] = await Promise.all([
    db.period.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { startAt: 'desc' },
    }),
    getSelectedPeriodId(),
  ])

  return <DashboardHeaderClient periods={periods} selectedPeriodId={selectedPeriodId} />
}
