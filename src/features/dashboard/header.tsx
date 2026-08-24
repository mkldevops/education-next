import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSchoolContext } from '@/lib/school-context'
import { DashboardHeaderClient } from './header-client'
import { getSelectedPeriodId } from './period'

export async function DashboardHeader() {
  const context = await getSchoolContext()

  // Le sélecteur de période est vide hors école active — un super-admin sans
  // aucune école dans le réseau, par exemple. Le reste de l'en-tête reste utile.
  if (!context) {
    const session = await auth.api.getSession({ headers: await headers() })
    return (
      <DashboardHeaderClient
        periods={[]}
        selectedPeriodId={null}
        userName={session?.user.name ?? null}
        userEmail={session?.user.email ?? null}
      />
    )
  }

  const [periods, selectedPeriodId, session] = await Promise.all([
    db.period.findMany({
      where: { schoolId: context.schoolId, isActive: true },
      select: { id: true, name: true, startAt: true, endAt: true },
      orderBy: { startAt: 'desc' },
    }),
    getSelectedPeriodId(context.schoolId),
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
