import { z } from 'zod'
import { schoolToday } from '@/domain/school-date'
import { mcpMealReadGateway } from '@/gateways/mcp-meal-read-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { db } from '@/lib/db'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'
import type { DraftScope } from './draft-scope'

export const studentMealsSchema = z.object({
  studentId: z.uuid(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
})
export const familyReceiptsSchema = z.object({
  familyId: z.uuid(),
  limit: z.number().int().min(1).max(100).default(50),
})

export async function getMealSettingsFromMcp(scope: DraftScope) {
  if (!(await isMealsEnabled(scope.schoolId))) return 'mealsDisabled' as const
  const [settings, prices] = await Promise.all([
    mcpMealReadGateway.settings(scope.schoolId),
    mcpMealReadGateway.prices(scope.schoolId),
  ])
  return {
    settings,
    prices: prices.map((price) => ({
      ...price,
      amount: Number(price.amount),
      effectiveFrom: price.effectiveFrom.toISOString().slice(0, 10),
    })),
  }
}

export async function getStudentMealsFromMcp(
  scope: DraftScope,
  input: z.infer<typeof studentMealsSchema>
) {
  const parsed = studentMealsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  if (!(await isMealsEnabled(schoolId))) return 'mealsDisabled' as const
  const { timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone)
  const from = parsed.data.from ?? `${today.slice(0, 7)}-01`
  const to =
    parsed.data.to ??
    new Date(Date.parse(`${from}T00:00:00Z`) + 30 * 86400000).toISOString().slice(0, 10)
  const span = Date.parse(to) - Date.parse(from)
  if (span < 0) return 'invalidDateRange' as const
  if (span > 92 * 86400000) return 'rangeTooLong' as const
  if (!(await mealAccountGateway.isActiveStudent(schoolId, parsed.data.studentId))) {
    return 'notFound' as const
  }
  const accounts = await mealAccountGateway.findStudentAccounts(schoolId, [parsed.data.studentId])
  const summaries = await loadMealAccountSummaries(db, { schoolId, accounts, today })
  return {
    studentId: parsed.data.studentId,
    today,
    from,
    to,
    accounts: accounts.flatMap((account) => {
      const summary = summaries.get(account.id)
      if (!summary) return []
      return {
        id: account.id,
        service: account.service,
        schedules: account.schedules,
        current: summary.current,
        coverage: summary.coverage,
        opening: summary.opening,
        unitPrice: summary.unitPrice,
        credit: summary.ledger.credit,
        calendar: summary.calendar.filter(({ day }) => day >= from && day <= to),
      }
    }),
  }
}

export async function listFamilyReceiptsFromMcp(
  scope: DraftScope,
  input: z.infer<typeof familyReceiptsSchema>
) {
  const parsed = familyReceiptsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  if (!(await isMealsEnabled(schoolId))) return 'mealsDisabled' as const
  if (!(await mcpMealReadGateway.familyExists(schoolId, parsed.data.familyId))) {
    return 'notFound' as const
  }
  const rows = await mcpMealReadGateway.receipts(
    schoolId,
    parsed.data.familyId,
    parsed.data.limit + 1
  )
  return { receipts: rows.slice(0, parsed.data.limit), hasMore: rows.length > parsed.data.limit }
}
