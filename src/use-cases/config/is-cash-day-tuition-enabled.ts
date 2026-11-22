import { cache } from 'react'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { configGateway } from '@/gateways/config-gateway'
import { CASH_DAY_TUITION_CONFIG_KEY } from '@/lib/cash-day-tuition-config'

/**
 * Opt-in : l'école qui encaisse l'écolage au guichet compte ses paiements sans reçu dans la
 * caisse du jour. L'absence de ligne vaut désactivé, la caisse restant faite des seuls reçus.
 */
const readFlag = cache(
  async (schoolId: string, configGw: typeof configGateway): Promise<boolean> => {
    const config = await configGw.get(schoolId, CASH_DAY_TUITION_CONFIG_KEY)

    return readsAsOptedIn(config?.value)
  }
)

export function isCashDayTuitionEnabled(
  schoolId: string,
  configGw: typeof configGateway = configGateway
): Promise<boolean> {
  return readFlag(schoolId, configGw)
}
