import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { staffMemberGateway } from '@/gateways/staff-member-gateway'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'

export type StaffRow = {
  id: string
  name: string
  note: string | null
  mealExempt: boolean
  isActive: boolean
  weekdays: number[]
  paidThrough: string | null
  dueDays: number
  dueAmount: number
  eatsToday: boolean
}

/** Personnel de l'école avec sa cantine : jours, payé jusqu'au, reste dû, repas du jour. */
export async function loadStaffRows(schoolId: string, today: string): Promise<StaffRow[]> {
  const staff = await staffMemberGateway.list(schoolId)
  const accounts = await mealAccountGateway.findStaffAccounts(
    schoolId,
    staff.map((member) => member.id)
  )
  const canteen = accounts.filter((account) => account.service === 'CANTEEN')
  const summaries = await mealAccountGateway.transaction((tx) =>
    loadMealAccountSummaries(tx, { schoolId, accounts: canteen, today })
  )

  return staff.map((member) => {
    const account = canteen.find((a) => a.staffMemberId === member.id)
    const summary = account ? summaries.get(account.id) : undefined
    const todayStatus = summary?.calendar.find(({ day }) => day === today)?.status
    return {
      ...member,
      weekdays: summary?.current?.weekdays ?? [],
      paidThrough: summary?.coverage.paidThrough ?? null,
      dueDays: member.mealExempt ? 0 : (summary?.coverage.dueDays ?? 0),
      dueAmount: member.mealExempt ? 0 : (summary?.coverage.dueAmount ?? 0),
      eatsToday: todayStatus !== undefined && todayStatus !== 'absent' && todayStatus !== 'closed',
    }
  })
}
