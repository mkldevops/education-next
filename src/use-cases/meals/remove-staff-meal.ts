import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { staffMealGateway } from '@/gateways/staff-meal-gateway'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { removeStaffMealSchema } from './schemas'

type Input = z.infer<typeof removeStaffMealSchema>

/** Le membre ne mange plus à ce service. Rien n'ayant été facturé, rien n'est à solder. */
export async function removeStaffMeal(
  input: Input,
  staffGw = staffMealGateway,
  configGw = configGateway
) {
  const parsed = removeStaffMealSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, teacherId, service } = parsed.data
  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const

  if ((await staffGw.remove(schoolId, teacherId, service)) === 0) return 'notSubscribed' as const
  return 'OK' as const
}
