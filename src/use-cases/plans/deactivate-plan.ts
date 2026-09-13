import type { z } from 'zod'
import { planGateway } from '@/gateways/plan-gateway'
import { deactivatePlanSchema } from './schemas'

type Input = z.infer<typeof deactivatePlanSchema>

export async function deactivatePlan(input: Input, planGw = planGateway) {
  const parsed = deactivatePlanSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, id } = parsed.data

  const plan = await planGw.findById(schoolId, id)
  if (!plan) return 'notFound' as const

  // Une inscription close garde sa formule archivée : seule une inscription encore à
  // facturer ou à modifier a besoin d'une formule sélectionnable.
  const openEnrollments = await planGw.countOpenEnrollments(schoolId, id)
  if (openEnrollments > 0) return 'planInUse' as const

  await planGw.deactivate(schoolId, id)
  return 'OK' as const
}
