import { BRANDING_CONFIG_KEYS, SCHOOL_NAME_CONFIG_KEY } from '@/lib/branding-config'
import { db } from '@/lib/db'

const BRANDING_CONFIG_NAMES = [...Object.values(BRANDING_CONFIG_KEYS), SCHOOL_NAME_CONFIG_KEY]

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
  const schoolName = findConfigValue(configs, SCHOOL_NAME_CONFIG_KEY)

  return {
    logoUrl,
    faviconUrl,
    schoolName,
  }
}

export async function getBrandingConfig() {
  const configs = await db.config.findMany({
    where: {
      name: { in: BRANDING_CONFIG_NAMES },
      isActive: true,
    },
    select: { name: true, value: true },
  })

  return resolveBrandingConfig(configs)
}
