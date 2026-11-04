import { resolveDebtorFamily } from '@/domain/family-debtor'
import { childcareGateway } from '@/gateways/childcare-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { db } from '@/lib/db'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'
import type { CashierChildcareLine, CashierLine } from '../_components/cashier-form'

/** Familles actives dont le nom, ou celui d'un membre, contient `query`. */
export async function searchCashierFamilies(schoolId: string, query: string) {
  const match = { contains: query, mode: 'insensitive' as const }
  const families = await db.family.findMany({
    where: {
      schoolId,
      isActive: true,
      OR: [
        { name: match },
        { persons: { some: { person: { OR: [{ name: match }, { lastname: match }] } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      persons: {
        where: { person: { student: { isNot: null } } },
        select: { person: { select: { name: true } } },
      },
    },
    orderBy: { name: 'asc' },
    take: 10,
  })
  return families.map((family) => ({
    id: family.id,
    name: family.name,
    children: family.persons.map(({ person }) => person.name),
  }))
}

/**
 * Lignes d'une famille, pour les seuls enfants dont elle est la famille redevable : un compte
 * repas par enfant et service, sauf sans jour servi, et chaque mois de garderie restant dû.
 */
export async function loadCashierFamily(schoolId: string, familyId: string, today: string) {
  const family = await db.family.findFirst({
    where: { id: familyId, schoolId, isActive: true },
    select: {
      id: true,
      name: true,
      persons: {
        select: {
          person: {
            select: {
              name: true,
              lastname: true,
              families: { select: { familyId: true, relationType: true } },
              student: { select: { id: true } },
            },
          },
        },
      },
    },
  })
  if (!family) return null

  const students = family.persons.flatMap(({ person }) =>
    person.student && resolveDebtorFamily(person.families)?.familyId === familyId
      ? [{ id: person.student.id, name: `${person.name} ${person.lastname}` }]
      : []
  )
  const accounts = await mealAccountGateway.findStudentAccounts(
    schoolId,
    students.map((student) => student.id)
  )
  const summaries = await mealAccountGateway.transaction((tx) =>
    loadMealAccountSummaries(tx, { schoolId, accounts, today })
  )

  const lines: CashierLine[] = accounts.flatMap((account) => {
    const summary = summaries.get(account.id)
    if (!summary || summary.served.length === 0) return []
    return [
      {
        studentId: account.studentId,
        name: students.find((student) => student.id === account.studentId)?.name ?? '',
        service: account.service,
        unitPrice: summary.unitPrice,
        served: summary.served,
        ledger: summary.ledger,
        paidThrough: summary.coverage.paidThrough,
        dueAmount: summary.coverage.dueAmount,
        dueDays: summary.coverage.dueDays,
        daysPerWeek: summary.current?.weekdays.length ?? 0,
      },
    ]
  })
  lines.sort((a, b) => a.name.localeCompare(b.name) || a.service.localeCompare(b.service))

  const charges = await childcareGateway.listOpenCharges(
    schoolId,
    students.map((student) => student.id)
  )
  const childcare: CashierChildcareLine[] = charges.map((charge) => ({
    chargeId: charge.chargeId,
    name: students.find((student) => student.id === charge.studentId)?.name ?? '',
    month: charge.month,
    remaining: charge.remaining,
  }))

  return { id: family.id, name: family.name, students, lines, childcare }
}

/** Reçu de famille tout juste émis, pour l'écran de confirmation de la caisse. */
export async function loadCashierReceipt(schoolId: string, receiptId: string) {
  const receipt = await db.receipt.findFirst({
    where: { id: receiptId, schoolId, familyId: { not: null } },
    select: {
      id: true,
      number: true,
      total: true,
      method: true,
      cancelledAt: true,
      family: { select: { name: true } },
    },
  })
  if (!receipt || receipt.cancelledAt) return null
  return {
    id: receipt.id,
    number: receipt.number,
    total: Number(receipt.total),
    method: receipt.method,
    family: receipt.family?.name ?? '',
  }
}
