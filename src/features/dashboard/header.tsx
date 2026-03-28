import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { DashboardHeaderClient } from './header-client'
import { PeriodSelector } from './period-selector'

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

  return (
    <header className="flex items-center justify-between px-6 py-3">
      <PeriodSelector periods={periods} selectedPeriodId={selectedPeriodId} />
      <DashboardHeaderClient />
    </header>
  )
}
