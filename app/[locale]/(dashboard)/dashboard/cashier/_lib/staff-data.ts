import { staffMealDue } from '@/domain/teacher'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { staffCanteenGateway } from '@/gateways/staff-canteen-gateway'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'

export type StaffRow = {
  id: string
  name: string
  mealExempt: boolean
  isActive: boolean
  weekdays: number[]
  paidThrough: string | null
  dueDays: number
  dueAmount: number
  eatsToday: boolean
}

/** Enseignants de l'école avec sa cantine : jours, payé jusqu'au, reste dû, repas du jour. */
export async function loadStaffRows(schoolId: string, today: string): Promise<StaffRow[]> {
  const staff = await staffCanteenGateway.list(schoolId)
  const accounts = await mealAccountGateway.findStaffAccounts(
    schoolId,
    staff.map((member) => member.id)
  )
  const canteen = accounts.filter((account) => account.service === 'CANTEEN')
  const summaries = await mealAccountGateway.transaction((tx) =>
    loadMealAccountSummaries(tx, { schoolId, accounts: canteen, today })
  )

  return staff.map((member) => {
    const account = canteen.find((a) => a.teacherId === member.id)
    const summary = account ? summaries.get(account.id) : undefined
    const todayStatus = summary?.calendar.find(({ day }) => day === today)?.status
    return {
      ...member,
      weekdays: summary?.current?.weekdays ?? [],
      paidThrough: summary?.coverage.paidThrough ?? null,
      ...staffMealDue(summary?.coverage, member.mealExempt),
      eatsToday: todayStatus !== undefined && todayStatus !== 'absent' && todayStatus !== 'closed',
    }
  })
}
