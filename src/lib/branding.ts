import { cookies } from 'next/headers'
import { schoolGateway } from '@/gateways/school-gateway'
import { BRANDING_CONFIG_KEYS } from '@/lib/branding-config'
import { db } from '@/lib/db'
import { ACTIVE_SCHOOL_COOKIE, getSchoolContext } from '@/lib/school-context'

const BRANDING_CONFIG_NAMES = Object.values(BRANDING_CONFIG_KEYS)

function findConfigValue(
  configs: Array<{ name: string; value: string }>,
  name: string
): string | undefined {
  const value = configs.find((config) => config.name === name)?.value.trim()
  return value || undefined
}

export function resolveBrandingConfig(configs: Array<{ name: string; value: string }>) {
  return {
    logoUrl: findConfigValue(configs, BRANDING_CONFIG_KEYS.logoUrl),
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
 * École désignée par le seul cookie, pour les surfaces qui peuvent être
 * demandées **hors session** — favicon, manifest PWA. Sans cookie valide, ou si
 * l'école qu'il désigne est désactivée, l'appelant retombe sur l'identité
 * plateforme. Interne : les appelants passent par `resolveBrandingSchoolId`.
 */
async function resolveSessionlessSchoolId(): Promise<string | undefined> {
  const requestedSchoolId = (await cookies()).get(ACTIVE_SCHOOL_COOKIE)?.value
  if (!requestedSchoolId) return undefined

  const school = await schoolGateway.findActiveById(requestedSchoolId)
  return school?.id
}

/**
 * École dont le branding doit habiller le rendu courant.
 *
 * Le contexte de session **primer sur le cookie**, car les deux divergent dès
 * qu'un cookie est périmé, désigne une école désactivée, ou une appartenance
 * révoquée : `getSchoolContext()` retombe alors sur la première appartenance,
 * et l'écran afficherait les données d'une école avec le thème par défaut d'une
 * autre. Le thème doit suivre l'école réellement affichée.
 *
 * Le cookie reste le repli pour les surfaces sans session.
 */
export async function resolveBrandingSchoolId(): Promise<string | undefined> {
  const context = await getSchoolContext()
  if (context) return context.schoolId

  return resolveSessionlessSchoolId()
}
