import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import type { DeepLinkResolution } from '@/domain/school-scope'
import { getSchoolContext, hasSchoolRole, isActiveSchoolAdmin } from '@/lib/school-context'

async function isSchoolAdmin(): Promise<boolean> {
  const context = await getSchoolContext()
  return context !== null && isActiveSchoolAdmin(context)
}

async function hasSchoolScope(): Promise<boolean> {
  const context = await getSchoolContext()
  if (!context) return false

  return isActiveSchoolAdmin(context) || context.familyId !== null
}

async function gatedTitle(
  locale: string,
  titleKey: string,
  allowed: Promise<boolean>
): Promise<Metadata> {
  const [t, ok] = await Promise.all([getTranslations({ locale }), allowed])

  return {
    title: ok ? t(titleKey) : t('errorPages.404.title'),
  }
}

export async function restrictedPageMetadata(locale: string, titleKey: string): Promise<Metadata> {
  return gatedTitle(locale, titleKey, isSchoolAdmin())
}

/** Titre des pages lisibles par un administrateur ou un parent rattaché. */
export async function schoolScopedPageMetadata(
  locale: string,
  titleKey: string
): Promise<Metadata> {
  return gatedTitle(locale, titleKey, hasSchoolScope())
}

/** Pages de la caisse : le titre suit `requireSchoolCashier()`, admin ou caissier. */
export async function cashierPageMetadata(locale: string, titleKey: string): Promise<Metadata> {
  return gatedTitle(
    locale,
    titleKey,
    getSchoolContext().then(
      (context) =>
        context !== null && (isActiveSchoolAdmin(context) || hasSchoolRole(context, 'CASHIER'))
    )
  )
}

/** Pendant plateforme : le titre ne fuite que pour un `isSuperAdmin`. */
export async function platformPageMetadata(locale: string, titleKey: string): Promise<Metadata> {
  return gatedTitle(
    locale,
    titleKey,
    getSchoolContext().then((context) => context?.isSuperAdmin === true)
  )
}

/**
 * Titre d'une page de détail à partir du **même** résolveur que la page.
 *
 * `generateMetadata` ne refait donc aucune requête par `id` seul : le résolveur est
 * mémoïsé par `React.cache()`, la page réutilise le résultat.
 */
export async function deepLinkTitle<T>(
  locale: string,
  resolution: DeepLinkResolution<T>,
  titleOf: (resource: T) => string
): Promise<Metadata> {
  if (resolution.status === 'found') return { title: titleOf(resolution.resource) }

  const t = await getTranslations({ locale })
  return {
    title:
      resolution.status === 'otherSchool' ? t('schools.deepLink.title') : t('errorPages.404.title'),
  }
}
