import { cache } from 'react'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { configGateway } from '@/gateways/config-gateway'
import { TEACHER_EXPENSES_CONFIG_KEY } from '@/lib/teacher-expense-config'

/**
 * Opt-in, à l'inverse de `isPaymentsEnabled` : les notes de frais ouvrent une fonction
 * que personne n'avait, donc l'absence de ligne vaut désactivé. Mémoïsé pour la durée
 * d'un rendu, et scopé par `schoolId` comme toute lecture de `Config`.
 */
const readFlag = cache(
  async (schoolId: string, configGw: typeof configGateway): Promise<boolean> => {
    const config = await configGw.get(schoolId, TEACHER_EXPENSES_CONFIG_KEY)

    return readsAsOptedIn(config?.value)
  }
)

export function isTeacherExpensesEnabled(
  schoolId: string,
  configGw: typeof configGateway = configGateway
): Promise<boolean> {
  return readFlag(schoolId, configGw)
}
