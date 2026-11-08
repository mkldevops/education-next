import type { z } from 'zod'
import { staffCanteenGateway } from '@/gateways/staff-canteen-gateway'
import { setStaffMealExemptSchema } from './schemas'

/** Exonère un enseignant de la cantine, ou lève l'exonération : ses repas restent comptés. */
export async function setStaffMealExempt(
  input: z.input<typeof setStaffMealExemptSchema>,
  gateway = staffCanteenGateway
) {
  const parsed = setStaffMealExemptSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, id, mealExempt } = parsed.data
  return (await gateway.setMealExempt(schoolId, id, mealExempt))
    ? ('OK' as const)
    : ('notFound' as const)
}
