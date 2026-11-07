import { cookies } from 'next/headers'
import { cache } from 'react'
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

/** Mémoïsé par requête : le shell auth et sa page le lisent tous deux. */
export const getBrandingConfig = cache(async (schoolId: string) => {
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
})

/**
 * Logo de chaque école listée, pour le menu de bascule. Les identifiants viennent de
 * `getAuthorizedSchools()` : l'appelant ne passe que des écoles déjà autorisées.
 */
export async function getSchoolLogoUrls(schoolIds: string[]): Promise<Record<string, string>> {
  if (schoolIds.length === 0) return {}

  const configs = await db.config.findMany({
    where: { schoolId: { in: schoolIds }, name: BRANDING_CONFIG_KEYS.logoUrl, isActive: true },
    select: { schoolId: true, value: true },
  })

  return Object.fromEntries(
    configs
      .map((config) => [config.schoolId, config.value.trim()] as const)
      .filter(([, value]) => value)
  )
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
