import { type MealLedger, servedDaysThrough } from '@/domain/meal-ledger'
import { staffMealDue } from '@/domain/teacher'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { staffCanteenGateway } from '@/gateways/staff-canteen-gateway'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'

export type StaffReceiptData = {
  unitPrice: number | null
  served: string[]
  ledger: MealLedger
  daysPerWeek: number
}

/** Montants de la période : versé, consommé à ce jour et dû, pour la barre de suivi. */
export type StaffProgress = { paid: number; total: number; expected: number; overdue: number }

export type StaffRow = {
  id: string
  name: string
  mealExempt: boolean
  isActive: boolean
  weekdays: number[]
  paidThrough: string | null
  dueDays: number
  dueAmount: number
  /** Repas prévu aujourd'hui : `eats`, `absent` s'il est signalé, `null` s'il n'est pas prévu. */
  today: 'eats' | 'absent' | null
  /** De quoi encaisser depuis la liste, `null` tant qu'aucun repas n'a été servi. */
  receipt: StaffReceiptData | null
  /** `null` pour un exempté, sans repas sur la période ou sans tarif. */
  progress: StaffProgress | null
}

function staffProgress(
  summary: { served: string[]; ledger: MealLedger; unitPrice: number | null } | undefined,
  dueAmount: number,
  mealExempt: boolean,
  today: string
): StaffProgress | null {
  if (mealExempt || !summary?.unitPrice || summary.served.length === 0) return null
  const { served, ledger, unitPrice } = summary
  return {
    paid: Math.min(ledger.days, served.length) * unitPrice,
    total: served.length * unitPrice,
    expected: servedDaysThrough(served, today) * unitPrice,
    overdue: dueAmount,
  }
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
    const weekdays = summary?.current?.weekdays ?? []
    const due = staffMealDue(summary?.coverage, member.mealExempt)
    return {
      ...member,
      weekdays,
      paidThrough: summary?.coverage.paidThrough ?? null,
      ...due,
      progress: staffProgress(summary, due.dueAmount, member.mealExempt, today),
      today:
        todayStatus === undefined || todayStatus === 'closed'
          ? null
          : todayStatus === 'absent'
            ? 'absent'
            : 'eats',
      receipt:
        summary && summary.served.length > 0
          ? {
              unitPrice: summary.unitPrice,
              served: summary.served,
              ledger: summary.ledger,
              daysPerWeek: weekdays.length,
            }
          : null,
    }
  })
}
