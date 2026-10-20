import { cache } from 'react'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { configGateway } from '@/gateways/config-gateway'
import { TEACHER_STAFF_ACCESS_CONFIG_KEY } from '@/lib/teacher-staff-access-config'

/**
 * Opt-in : l'accès élargi ouvre aux enseignants des fiches qu'ils ne lisaient pas, donc
 * l'absence de ligne vaut désactivé. Mémoïsé pour la durée d'un rendu.
 */
export const isTeacherStaffAccessEnabled = cache(async (schoolId: string): Promise<boolean> => {
  const config = await configGateway.get(schoolId, TEACHER_STAFF_ACCESS_CONFIG_KEY)

  return readsAsOptedIn(config?.value)
})
