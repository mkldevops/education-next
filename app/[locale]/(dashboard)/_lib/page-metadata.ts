import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import type { DeepLinkResolution } from '@/domain/school-scope'
import { getSchoolContext, isActiveSchoolAdmin } from '@/lib/school-context'

async function isSchoolAdmin(): Promise<boolean> {
  const context = await getSchoolContext()
  return context !== null && isActiveSchoolAdmin(context)
}

async function hasSchoolScope(): Promise<boolean> {
  const context = await getSchoolContext()
  if (!context) return false

  return (
    context.isSuperAdmin ||
    context.role === 'ADMIN' ||
    (context.role === 'PARENT' && context.familyId !== null)
  )
}

export async function restrictedPageMetadata(locale: string, titleKey: string): Promise<Metadata> {
  const [t, allowed] = await Promise.all([getTranslations({ locale }), isSchoolAdmin()])

  return {
    title: allowed ? t(titleKey) : t('errorPages.404.title'),
  }
}

/** Titre des pages lisibles par un administrateur ou un parent rattaché. */
export async function schoolScopedPageMetadata(
  locale: string,
  titleKey: string
): Promise<Metadata> {
  const [t, allowed] = await Promise.all([getTranslations({ locale }), hasSchoolScope()])

  return {
    title: allowed ? t(titleKey) : t('errorPages.404.title'),
  }
}

/** Pendant plateforme : le titre ne fuite que pour un `isSuperAdmin`. */
export async function platformPageMetadata(locale: string, titleKey: string): Promise<Metadata> {
  const [t, context] = await Promise.all([getTranslations({ locale }), getSchoolContext()])

  return {
    title: context?.isSuperAdmin ? t(titleKey) : t('errorPages.404.title'),
  }
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
