import { cache } from 'react'
import { readsAsEnabled } from '@/domain/feature-flags'
import { configGateway } from '@/gateways/config-gateway'
import { PAYMENTS_ENABLED_CONFIG_KEY } from '@/lib/payment-config'

/**
 * Mémoïsé pour la durée d'un rendu : la barre latérale, le layout et la page consultent
 * le même drapeau dans une seule requête. Hors rendu — action serveur, test — `cache()`
 * se réduit à un appel direct, donc le verdict suit la base sans cache inter-requêtes.
 *
 * La lecture passe par `configGateway`, donc porte `schoolId` : le garde tenant est
 * satisfait et le drapeau d'une école ne peut jamais décider pour une autre.
 */
const readFlag = cache(
  async (schoolId: string, configGw: typeof configGateway): Promise<boolean> => {
    const config = await configGw.get(schoolId, PAYMENTS_ENABLED_CONFIG_KEY)

    return readsAsEnabled(config?.value)
  }
)

export function isPaymentsEnabled(
  schoolId: string,
  configGw: typeof configGateway = configGateway
): Promise<boolean> {
  return readFlag(schoolId, configGw)
}
