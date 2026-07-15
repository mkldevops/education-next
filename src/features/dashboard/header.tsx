import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { DashboardHeaderClient } from './header-client'
import { getSelectedPeriodId } from './period'

export async function DashboardHeader() {
  const [periods, selectedPeriodId, session] = await Promise.all([
    db.period.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { startAt: 'desc' },
    }),
    getSelectedPeriodId(),
    auth.api.getSession({ headers: await headers() }),
  ])

  return (
    <DashboardHeaderClient
      periods={periods}
      selectedPeriodId={selectedPeriodId}
      userName={session?.user.name ?? null}
      userEmail={session?.user.email ?? null}
    />
  )
}
