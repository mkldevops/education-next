import { cache } from 'react'
import { configGateway } from '@/gateways/config-gateway'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'

/**
 * Mémoïsé pour la durée d'un rendu, comme `isPaymentsEnabled` : le bandeau J-x et la carte
 * « Prochains événements » du tableau de bord lisent le même drapeau dans une seule requête.
 *
 * Contrairement à `isPaymentsEnabled` (`readsAsEnabled` : absence de ligne = activé), ce
 * drapeau est désactivé par défaut (`EVENTS_CONFIG_DEFAULT.value = 'false'`) — la même
 * sémantique fail-closed que `createEvent`/`updateEvent`/`archiveEvent`, qui refusent déjà
 * sur `config?.value !== 'true'`.
 */
const readFlag = cache(
  async (schoolId: string, configGw: typeof configGateway): Promise<boolean> => {
    const config = await configGw.get(schoolId, EVENTS_CONFIG_KEY)
    return config?.value === 'true'
  }
)

export function isEventsEnabled(
  schoolId: string,
  configGw: typeof configGateway = configGateway
): Promise<boolean> {
  return readFlag(schoolId, configGw)
}
