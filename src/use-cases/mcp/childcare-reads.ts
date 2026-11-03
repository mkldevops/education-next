import { z } from 'zod'
import { chargeLeft, monthOfDay, summarizeChildcare } from '@/domain/childcare'
import { resolveDebtorFamily } from '@/domain/family-debtor'
import { schoolToday } from '@/domain/school-date'
import { childcareGateway } from '@/gateways/childcare-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import type { DraftScope } from './draft-scope'

export const studentChildcareSchema = z.object({ studentId: z.uuid() })

/** Garderie d'un enfant telle que l'écran garderie la montre, mois facturés compris. */
export async function getStudentChildcareFromMcp(
  scope: DraftScope,
  input: z.infer<typeof studentChildcareSchema>
) {
  const parsed = studentChildcareSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  const { studentId } = parsed.data
  if (!(await isMealsEnabled(schoolId))) return 'mealsDisabled' as const
  if (!(await mealAccountGateway.isActiveStudent(schoolId, studentId))) return 'notFound' as const
  const [{ timeZone }, [row]] = await Promise.all([
    getSchoolRegionalSettings(schoolId),
    childcareGateway.listSubscriptions(schoolId, studentId),
  ])
  const currentMonth = monthOfDay(schoolToday(timeZone))
  if (!row) {
    return { studentId, currentMonth, debtorFamilyId: null, subscription: null, charges: [] }
  }
  return {
    studentId,
    currentMonth,
    debtorFamilyId: resolveDebtorFamily(row.student.person.families)?.familyId ?? null,
    subscription: {
      monthlyAmount: row.monthlyAmount,
      startMonth: row.startMonth,
      endMonth: row.endMonth,
      opening: row.opening,
    },
    totals: summarizeChildcare(row.charges),
    charges: row.charges.map((charge) => ({
      chargeId: charge.id,
      month: charge.month,
      amount: charge.amount,
      paidByReceipts: charge.paid,
      settledByOpening: charge.settled,
      remaining: charge.cancelled ? 0 : chargeLeft(charge),
      cancelled: charge.cancelled,
    })),
  }
}
