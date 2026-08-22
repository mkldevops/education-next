import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getSchoolContext } from '@/lib/school-context'

async function isSchoolAdmin(): Promise<boolean> {
  const context = await getSchoolContext()
  if (!context) return false
  return context.isSuperAdmin || context.role === 'ADMIN'
}

export async function notFoundTitle(locale: string): Promise<string> {
  const t = await getTranslations({ locale })
  return t('errorPages.404.title')
}

export async function restrictedPageMetadata(locale: string, titleKey: string): Promise<Metadata> {
  const [t, allowed] = await Promise.all([getTranslations({ locale }), isSchoolAdmin()])

  return {
    title: allowed ? t(titleKey) : t('errorPages.404.title'),
  }
}
