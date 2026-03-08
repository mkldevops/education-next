import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSessionWithRole } from '../../_lib/auth-helper'
import { SettingsTabs } from './_components/settings-tabs'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'settings' })

  return {
    title: t('title'),
  }
}

export default async function SettingsPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  await getSessionWithRole()

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const sessions = await db.session.findMany({
    where: {
      userId: session.user.id,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  const sessionData = sessions.map((s) => ({
    id: s.id,
    token: s.token,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    isCurrent: s.token === session.session.token,
  }))

  const accounts = await db.account.findMany({
    where: { userId: session.user.id },
    select: { providerId: true, accountId: true },
  })

  const linkedProviders = accounts
    .filter((a) => a.providerId !== 'credential')
    .map((a) => a.providerId)

  return (
    <SettingsTabs
      user={{
        name: session.user.name || '',
        email: session.user.email,
        image: session.user.image || null,
      }}
      sessions={sessionData}
      linkedProviders={linkedProviders}
    />
  )
}
