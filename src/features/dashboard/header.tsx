import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { DashboardHeaderClient } from './header-client'

export async function DashboardHeader() {
  const [periods, cookieStore] = await Promise.all([
    db.period.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { startAt: 'desc' },
    }),
    cookies(),
  ])

  const cookiePeriodId = cookieStore.get('selected_period')?.value ?? null
  const selectedPeriodId = cookiePeriodId ?? periods[0]?.id ?? null

  return <DashboardHeaderClient periods={periods} selectedPeriodId={selectedPeriodId} />
}
