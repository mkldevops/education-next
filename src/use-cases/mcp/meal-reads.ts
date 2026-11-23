import { z } from 'zod'
import { segmentFrom } from '@/domain/meal-schedule'
import { schoolToday } from '@/domain/school-date'
import { staffMealDue } from '@/domain/teacher'
import { mcpMealReadGateway } from '@/gateways/mcp-meal-read-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { staffCanteenGateway } from '@/gateways/staff-canteen-gateway'
import { MealService } from '@/generated/prisma/enums'
import { db } from '@/lib/db'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'
import { loadMealDebtors } from '@/use-cases/meals/meal-debtors'
import type { DraftScope } from './draft-scope'

export const studentMealsSchema = z.object({
  studentId: z.uuid(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
})
export const staffMealsSchema = z.object({
  teacherId: z.uuid(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
})
export const staffMealSubscriptionsSchema = z.object({
  service: z.enum(MealService).optional(),
  date: z.iso.date().optional(),
})
export const mealDebtorsSchema = z.object({ service: z.enum(MealService).optional() })
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

/** Fenêtre du calendrier : `from`/`to` inclus, 93 jours au plus, 31 jours par défaut. */
function calendarRange(today: string, input: { from?: string; to?: string }) {
  const from = input.from ?? `${today.slice(0, 7)}-01`
  const to =
    input.to ?? new Date(Date.parse(`${from}T00:00:00Z`) + 30 * 86400000).toISOString().slice(0, 10)
  const span = Date.parse(to) - Date.parse(from)
  if (span < 0) return 'invalidDateRange' as const
  if (span > 92 * 86400000) return 'rangeTooLong' as const
  return { from, to }
}

/**
 * Comptes d'un titulaire comme sur sa fiche : segments, prix du jour, reprise, couverture et
 * calendrier borné. Un membre exempté ne doit rien (`staffMealDue`).
 */
async function describeAccounts<
  A extends { id: string; service: MealService; schedules: unknown[] },
>(
  schoolId: string,
  accounts: A[],
  today: string,
  range: { from: string; to: string },
  exempt = false
) {
  const summaries = await loadMealAccountSummaries(db, { schoolId, accounts, today })
  return accounts.flatMap((account) => {
    const summary = summaries.get(account.id)
    if (!summary) return []
    return {
      id: account.id,
      service: account.service,
      schedules: account.schedules,
      current: summary.current,
      coverage: exempt
        ? { ...summary.coverage, ...staffMealDue(summary.coverage, true) }
        : summary.coverage,
      opening: summary.opening,
      unitPrice: summary.unitPrice,
      credit: summary.ledger.credit,
      calendar: summary.calendar.filter(({ day }) => day >= range.from && day <= range.to),
    }
  })
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
  const range = calendarRange(today, parsed.data)
  if (typeof range === 'string') return range
  if (!(await mealAccountGateway.isActiveStudent(schoolId, parsed.data.studentId))) {
    return 'notFound' as const
  }
  const accounts = await mealAccountGateway.findStudentAccounts(schoolId, [parsed.data.studentId])
  return {
    studentId: parsed.data.studentId,
    today,
    ...range,
    accounts: await describeAccounts(schoolId, accounts, today, range),
  }
}

/** Fiche repas d'un membre du personnel actif, au format de `get_student_meals`. */
export async function getStaffMealsFromMcp(
  scope: DraftScope,
  input: z.infer<typeof staffMealsSchema>
) {
  const parsed = staffMealsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  if (!(await isMealsEnabled(schoolId))) return 'mealsDisabled' as const
  const { timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone)
  const range = calendarRange(today, parsed.data)
  if (typeof range === 'string') return range
  const member = await staffCanteenGateway.find(schoolId, parsed.data.teacherId)
  if (!member?.isActive) return 'notFound' as const
  const accounts = await mealAccountGateway.findStaffAccounts(schoolId, [member.id])
  return {
    teacherId: member.id,
    name: member.name,
    mealExempt: member.mealExempt,
    today,
    ...range,
    accounts: await describeAccounts(schoolId, accounts, today, range, member.mealExempt),
  }
}

/**
 * Personnel actif de l'école et ses comptes repas : segment qui sert `date` (ou le prochain),
 * tous les segments, payé jusqu'au et reste dû au jour de l'école. Sans compte : `accounts` vide.
 */
/**
 * Élèves à relancer pour la cantine ou le goûter, au même calcul que l'écran « impayés » de
 * la caisse : jours dus, ou presque plus aucun jour payé devant soi.
 */
export async function listMealDebtorsFromMcp(
  scope: DraftScope,
  input: z.infer<typeof mealDebtorsSchema>,
  loadDebtors = loadMealDebtors
) {
  const parsed = mealDebtorsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  if (!(await isMealsEnabled(schoolId))) return 'mealsDisabled' as const
  const { timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone)
  const { service } = parsed.data
  const rows = await loadDebtors(schoolId, today)
  const debtors = service ? rows.filter((row) => row.service === service) : rows
  return {
    today,
    count: debtors.length,
    dueAmount: debtors.reduce((sum, row) => sum + row.dueAmount, 0),
    debtors,
  }
}

export async function listStaffMealSubscriptionsFromMcp(
  scope: DraftScope,
  input: z.infer<typeof staffMealSubscriptionsSchema>
) {
  const parsed = staffMealSubscriptionsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  if (!(await isMealsEnabled(schoolId))) return 'mealsDisabled' as const
  const { timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone)
  const date = parsed.data.date ?? today
  const staff = (await staffCanteenGateway.list(schoolId)).filter((member) => member.isActive)
  const accounts = (
    await mealAccountGateway.findStaffAccounts(
      schoolId,
      staff.map((member) => member.id)
    )
  ).filter((account) => !parsed.data.service || account.service === parsed.data.service)
  const summaries = await loadMealAccountSummaries(db, { schoolId, accounts, today })
  return {
    today,
    date,
    staff: staff.map((member) => ({
      teacherId: member.id,
      name: member.name,
      mealExempt: member.mealExempt,
      accounts: accounts
        .filter((account) => account.teacherId === member.id)
        .map((account) => {
          const coverage = summaries.get(account.id)?.coverage
          return {
            id: account.id,
            service: account.service,
            segment: segmentFrom(account.schedules, date),
            schedules: account.schedules,
            paidThrough: coverage?.paidThrough ?? null,
            ...staffMealDue(coverage, member.mealExempt),
          }
        }),
    })),
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
