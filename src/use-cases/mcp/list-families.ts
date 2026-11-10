import type { z } from 'zod'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { getPaymentTrackingByFamily } from '@/use-cases/payments/payment-tracking'
import type { DraftScope } from './draft-scope'
import { MCP_FAMILY_LIST_DEFAULT, mcpListFamiliesSchema } from './schemas'

type Input = z.infer<typeof mcpListFamiliesSchema>

/**
 * Annuaire complet des familles de l'école, page par page, avec leurs enfants et leur
 * classe actuelle : la recherche par nom ne permet pas de vérifier qu'aucune famille ne
 * manque. Avec les paiements actifs, chaque famille porte aussi son suivi de paiement, et
 * `overdueOnly` ne garde que celles en retard.
 */
export async function listFamiliesFromMcp(
  scope: DraftScope,
  input: Input,
  readGw = mcpReadGateway,
  trackingByFamily = getPaymentTrackingByFamily
) {
  const parsed = mcpListFamiliesSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { offset = 0, limit = MCP_FAMILY_LIST_DEFAULT, overdueOnly = false } = parsed.data
  if (overdueOnly && !scope.paymentsEnabled) return 'paymentsDisabled' as const
  const { schoolId } = scope

  const tracking = scope.paymentsEnabled ? await trackingByFamily(schoolId) : []
  const trackingById = new Map(tracking.map((row) => [row.familyId, row]))
  const familyIds = overdueOnly
    ? tracking.filter((row) => row.overdueAmount > 0).map((row) => row.familyId)
    : undefined

  const { total, rows } = await readGw.listFamilies(schoolId, {
    skip: offset,
    take: limit,
    familyIds,
  })

  return {
    total,
    offset,
    nextOffset: offset + rows.length < total ? offset + rows.length : null,
    families: rows.map((family) => {
      const payment = trackingById.get(family.id)
      return {
        id: family.id,
        name: family.name,
        children: family.persons.flatMap(({ person }) =>
          person.student
            ? [
                {
                  studentId: person.student.id,
                  name: person.name,
                  lastname: person.lastname,
                  enrollments: person.student.enrollments.map((enrollment) => ({
                    status: enrollment.status,
                    classes: enrollment.classAssignments.map((row) => row.classPeriod),
                  })),
                },
              ]
            : []
        ),
        ...(scope.paymentsEnabled
          ? {
              payments: payment
                ? {
                    paidToDate: payment.paidToDate,
                    expectedToDate: payment.expectedToDate,
                    overdueAmount: payment.overdueAmount,
                    tracked: payment.tracked,
                  }
                : null,
            }
          : {}),
      }
    }),
  }
}
