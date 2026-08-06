import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Role } from '@/types/enums'

async function getRole(): Promise<Role | undefined> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return undefined

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  return user?.role
}

export async function notFoundTitle(locale: string): Promise<string> {
  const t = await getTranslations({ locale })
  return t('errorPages.404.title')
}

export async function restrictedPageMetadata(
  locale: string,
  titleKey: string,
  allowedRoles: Role[]
): Promise<Metadata> {
  const [t, role] = await Promise.all([getTranslations({ locale }), getRole()])

  return {
    title: role && allowedRoles.includes(role) ? t(titleKey) : t('errorPages.404.title'),
  }
}
