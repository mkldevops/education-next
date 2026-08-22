import { cookies } from 'next/headers'
import { schoolGateway } from '@/gateways/school-gateway'
import { BRANDING_CONFIG_KEYS } from '@/lib/branding-config'
import { db } from '@/lib/db'
import { ACTIVE_SCHOOL_COOKIE } from '@/lib/school-context'

const BRANDING_CONFIG_NAMES = Object.values(BRANDING_CONFIG_KEYS)

function findConfigValue(
  configs: Array<{ name: string; value: string }>,
  name: string
): string | undefined {
  const value = configs.find((config) => config.name === name)?.value.trim()
  return value || undefined
}

export function resolveBrandingConfig(configs: Array<{ name: string; value: string }>) {
  const logoUrl = findConfigValue(configs, BRANDING_CONFIG_KEYS.logoUrl)
  const faviconUrl = findConfigValue(configs, BRANDING_CONFIG_KEYS.faviconUrl) || logoUrl

  return {
    logoUrl,
    faviconUrl,
  }
}

export async function getBrandingConfig(schoolId: string) {
  const [configs, school] = await Promise.all([
    db.config.findMany({
      where: {
        schoolId,
        name: { in: BRANDING_CONFIG_NAMES },
        isActive: true,
      },
      select: { name: true, value: true },
    }),
    schoolGateway.findActiveById(schoolId),
  ])

  return {
    ...resolveBrandingConfig(configs),
    schoolName: school?.name,
  }
}

/**
 * École active pour les surfaces hors session — favicon, manifest PWA, thème du
 * layout racine. Ces routes rendent avant toute authentification et ne peuvent
 * donc pas dépendre de `getSchoolContext()`. Sans cookie valide, ou si l'école
 * qu'il désigne est désactivée, l'appelant retombe sur le thème par défaut.
 */
export async function resolveSessionlessSchoolId(): Promise<string | undefined> {
  const requestedSchoolId = (await cookies()).get(ACTIVE_SCHOOL_COOKIE)?.value
  if (!requestedSchoolId) return undefined

  const school = await schoolGateway.findActiveById(requestedSchoolId)
  return school?.id
}
