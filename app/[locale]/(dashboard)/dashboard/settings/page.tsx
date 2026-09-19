import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSchoolContext } from '@/lib/school-context'
import { listMcpApiKeys } from '@/use-cases/mcp/list-mcp-api-keys'
import { isGoogleSignInAvailable } from '@/use-cases/platform-settings/is-google-sign-in-available'
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

  // Chargées ici, et non au montage du composant : le drapeau éteint n'affiche la carte
  // que si l'utilisateur possède au moins une passkey, et un aller-retour client laisserait
  // le temps du chargement un écran vide — c'est-à-dire le symptôme même de l'issue #264.
  const [sessions, accounts, passkeys, googleEnabled, passkeyEnabled, apiKeys] = await Promise.all([
    db.session.findMany({
      where: {
        userId: session.user.id,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, token: true, userAgent: true, ipAddress: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.account.findMany({
      where: { userId: session.user.id },
      select: { id: true, providerId: true },
    }),
    db.passkey.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, deviceType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    isGoogleSignInAvailable(),
    isPasskeySignInEnabled(),
    loadApiKeys(),
  ])

  const sessionData = sessions.map((s) => ({
    id: s.id,
    token: s.token,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt.toISOString(),
    isCurrent: s.token === session.session.token,
  }))

  const linkedAccounts = accounts.filter((a) => a.providerId !== 'credential')

  return (
    <SettingsTabs
      user={{
        name: session.user.name || '',
        email: session.user.email,
      }}
      sessions={sessionData}
      linkedAccounts={linkedAccounts}
      passkeys={passkeys}
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
