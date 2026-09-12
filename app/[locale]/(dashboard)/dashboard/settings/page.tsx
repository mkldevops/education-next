import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSchoolContext } from '@/lib/school-context'
import { isGoogleConfigured } from '@/lib/social-providers'
import { listMcpApiKeys } from '@/use-cases/mcp/list-mcp-api-keys'
import { isGoogleSignInEnabled } from '@/use-cases/platform-settings/is-google-sign-in-enabled'
import { isMcpEnabled } from '@/use-cases/platform-settings/is-mcp-enabled'
import { isPasskeySignInEnabled } from '@/use-cases/platform-settings/is-passkey-sign-in-enabled'
import { SettingsTabs } from './_components/settings-tabs'
import { toMcpApiKeyView } from './_lib/mcp-api-key-view'

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

  // Page à portée utilisateur, pas école : la session suffit, et `/dashboard` est
  // déjà protégé par `proxy.ts`.
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
    select: { id: true, providerId: true },
  })

  const linkedAccounts = accounts.filter((a) => a.providerId !== 'credential')

  const [googleEnabled, passkeyEnabled] = await Promise.all([
    isGoogleConfigured ? isGoogleSignInEnabled() : Promise.resolve(false),
    isPasskeySignInEnabled(),
  ])

  const apiKeys = await loadApiKeys()

  return (
    <SettingsTabs
      user={{
        name: session.user.name || '',
        email: session.user.email,
        image: session.user.image || null,
      }}
      sessions={sessionData}
      linkedAccounts={linkedAccounts}
      googleEnabled={googleEnabled}
      passkeyEnabled={passkeyEnabled}
      apiKeys={apiKeys}
    />
  )
}

/**
 * L'onglet n'existe que pour un administrateur de l'école active, et seulement quand le
 * serveur MCP est ouvert : `null` retire l'onglet, il ne l'affiche pas vide.
 *
 * La page reste à portée utilisateur pour tout le reste ; le contexte d'école n'est lu
 * que pour cette section, sans redirection — un parent garde ses autres onglets.
 */
async function loadApiKeys() {
  const context = await getSchoolContext()
  if (!context) return null
  if (!context.isSuperAdmin && context.role !== 'ADMIN') return null
  if (!(await isMcpEnabled())) return null

  const keys = await listMcpApiKeys(context.userId, context.schoolId)

  return keys.map(toMcpApiKeyView)
}
