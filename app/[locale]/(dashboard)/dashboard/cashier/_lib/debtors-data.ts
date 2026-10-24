import { resolveDebtorFamily } from '@/domain/family-debtor'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { db } from '@/lib/db'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'

/** Jours encore couverts sous lesquels un enfant toujours inscrit est à relancer. */
export const REMIND_WITHIN_DAYS = 2

/**
 * Comptes repas à encaisser (écran « impayés ») : des jours dus, ou des jours à venir dont
 * seuls `REMIND_WITHIN_DAYS` au plus sont couverts. Les plus gros montants dus d'abord.
 */
export async function loadMealDebtors(schoolId: string, today: string) {
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

  const rows = accounts.flatMap((account) => {
    const summary = summaries.get(account.id)
    const student = students.find((s) => s.id === account.studentId)
    if (!summary || !student) return []
    const { coverage } = summary
    // Des jours restent à servir au-delà de la couverture : un abonnement qui finit payé ne
    // demande rien.
    const unpaidAhead = summary.served.filter((day) => day >= today).length > coverage.coveredLeft
    if (coverage.dueDays === 0 && !(unpaidAhead && coverage.coveredLeft <= REMIND_WITHIN_DAYS)) {
      return []
    }
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
  return rows.sort(
    (a, b) =>
      b.dueAmount - a.dueAmount || a.coveredLeft - b.coveredLeft || a.name.localeCompare(b.name)
  )
}
