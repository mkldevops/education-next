import { resolveDebtorFamily } from '@/domain/family-debtor'
import type { MealAccountSummary } from '@/domain/meal-account-summary'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import type { MealService } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'
import { familyContactPhones } from '@/use-cases/payments/payment-stats'

/** Jours encore couverts sous lesquels un enfant toujours inscrit est à relancer. */
export const REMIND_WITHIN_DAYS = 2

async function loadMealAccountStates(schoolId: string, today: string) {
  const students = await db.student.findMany({
    where: { schoolId, isActive: true, mealAccounts: { some: {} } },
    select: {
      id: true,
      person: {
        select: {
          name: true,
          lastname: true,
          families: { select: { familyId: true, relationType: true } },
        },
      },
    },
  })
  const accounts = await mealAccountGateway.findStudentAccounts(
    schoolId,
    students.map((student) => student.id)
  )
  const summaries = await mealAccountGateway.transaction((tx) =>
    loadMealAccountSummaries(tx, { schoolId, accounts, today })
  )
  return { students, accounts, summaries }
}

/**
 * Des jours dus, ou des jours restant à servir au-delà d'une couverture presque épuisée : un
 * abonnement qui finit payé ne demande rien.
 */
function needsReminder(summary: MealAccountSummary, today: string) {
  const { coverage } = summary
  const unpaidAhead = summary.served.filter((day) => day >= today).length > coverage.coveredLeft
  return coverage.dueDays > 0 || (unpaidAhead && coverage.coveredLeft <= REMIND_WITHIN_DAYS)
}

/**
 * Comptes repas à encaisser (écran « impayés ») : des jours dus, ou des jours à venir dont
 * seuls `REMIND_WITHIN_DAYS` au plus sont couverts. Les plus gros montants dus d'abord. Chaque
 * ligne porte le téléphone de la famille redevable, pour la relancer.
 */
export async function loadMealDebtors(schoolId: string, today: string) {
  const { students, accounts, summaries } = await loadMealAccountStates(schoolId, today)

  const rows = accounts.flatMap((account) => {
    const summary = summaries.get(account.id)
    const student = students.find((s) => s.id === account.studentId)
    if (!summary || !student || !needsReminder(summary, today)) return []
    const { coverage } = summary
    return [
      {
        studentId: student.id,
        name: `${student.person.name} ${student.person.lastname}`,
        familyId: resolveDebtorFamily(student.person.families)?.familyId ?? null,
        service: account.service,
        paidThrough: coverage.paidThrough,
        dueDays: coverage.dueDays,
        dueAmount: coverage.dueAmount,
        coveredLeft: coverage.coveredLeft,
      },
    ]
  })
  const phones = await familyContactPhones(schoolId, [
    ...new Set(rows.flatMap((row) => (row.familyId ? [row.familyId] : []))),
  ])
  return rows
    .map((row) => ({ ...row, phone: row.familyId ? (phones.get(row.familyId) ?? null) : null }))
    .sort(
      (a, b) =>
        b.dueAmount - a.dueAmount || a.coveredLeft - b.coveredLeft || a.name.localeCompare(b.name)
    )
}

export type MealServiceDues = {
  service: MealService
  /** Comptes avec un repas servi ou dû : un abonnement arrêté et soldé ne compte plus. */
  subscribed: number
  /** Comptes à jour : aucun jour servi impayé. */
  upToDate: number
  overdue: number
  dueAmount: number
}

/**
 * Bilan repas de l'accueil, par service, au même calcul que l'écran « impayés » : jours
 * servis non couverts, au tarif du jour.
 */
export async function loadMealDues(schoolId: string, today: string) {
  const { accounts, summaries } = await loadMealAccountStates(schoolId, today)
  const byService = new Map<MealService, MealServiceDues>()

  for (const account of accounts) {
    const summary = summaries.get(account.id)
    if (!summary) continue
    const active = summary.served.some((day) => day >= today) || summary.coverage.dueDays > 0
    if (!active) continue
    const entry = byService.get(account.service) ?? {
      service: account.service,
      subscribed: 0,
      upToDate: 0,
      overdue: 0,
      dueAmount: 0,
    }
    entry.subscribed += 1
    if (summary.coverage.dueDays > 0) {
      entry.overdue += 1
      entry.dueAmount += summary.coverage.dueAmount
    } else {
      entry.upToDate += 1
    }
    byService.set(account.service, entry)
  }

  const services = [...byService.values()].sort((a, b) => a.service.localeCompare(b.service))
  const toRemind = accounts.filter((account) => {
    const summary = summaries.get(account.id)
    return summary !== undefined && needsReminder(summary, today)
  }).length
  return {
    services,
    toRemind,
    dueAmount: services.reduce((sum, entry) => sum + entry.dueAmount, 0),
  }
}
