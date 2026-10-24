import { cache } from 'react'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { configGateway } from '@/gateways/config-gateway'
import { MEALS_ENABLED_CONFIG_KEY } from '@/lib/meals-config'

/**
 * Opt-in : cantine et goûter ne concernent que les écoles qui les servent, donc l'absence
 * de ligne vaut désactivé. Mémoïsé pour la durée d'un rendu.
 */
const readFlag = cache(
  async (schoolId: string, configGw: typeof configGateway): Promise<boolean> => {
    const config = await configGw.get(schoolId, MEALS_ENABLED_CONFIG_KEY)

    return readsAsOptedIn(config?.value)
  }
)

export function isMealsEnabled(
  schoolId: string,
  configGw: typeof configGateway = configGateway
): Promise<boolean> {
  return readFlag(schoolId, configGw)
}
