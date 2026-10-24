import { cache } from 'react'
import { schoolGateway } from '@/gateways/school-gateway'
import { DEFAULT_CURRENCY } from '@/lib/decimal'

const DEFAULT_TIME_ZONE = 'Europe/Paris'

export type SchoolRegionalSettings = { currency: string; timeZone: string }

/**
 * Devise et fuseau de l'école, mémoïsés pour la durée d'un rendu : une page et ses
 * composants serveur les lisent sans multiplier les requêtes.
 */
export const getSchoolRegionalSettings = cache(
  async (schoolId: string): Promise<SchoolRegionalSettings> =>
    (await schoolGateway.findRegionalSettings(schoolId)) ?? {
      currency: DEFAULT_CURRENCY,
      timeZone: DEFAULT_TIME_ZONE,
    }
)
