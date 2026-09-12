'use client'

import { Tabs } from '@peaklab/ui'
import { KeyRound, Monitor, Plug, Shield, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { McpApiKeyView } from '../_lib/mcp-api-key-view'
import { AccountSection } from './account-section'
import { ApiKeysSection } from './api-keys-section'
import { PasskeySection } from './passkey-section'
import { PasswordSection } from './password-section'
import { ProfileSection } from './profile-section'
import { SessionsSection } from './sessions-section'

type SessionData = {
  id: string
  token: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  expiresAt: string
  isCurrent: boolean
}

type LinkedAccount = {
  id: string
  providerId: string
}

type Props = {
  user: {
    name: string
    email: string
    image: string | null
  }
  sessions: SessionData[]
  linkedAccounts: LinkedAccount[]
  googleEnabled: boolean
  passkeyEnabled: boolean
  apiKeys: McpApiKeyView[] | null
}

export function SettingsTabs({
  user,
  sessions,
  linkedAccounts,
  googleEnabled,
  passkeyEnabled,
  apiKeys,
}: Props) {
  const t = useTranslations('settings')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>

      <Tabs
        tabs={[
          {
            label: t('tabs.profile'),
            icon: User,
            content: <ProfileSection user={user} />,
          },
          {
            label: t('tabs.security'),
            icon: KeyRound,
            content: (
              <div className="space-y-6">
                <PasswordSection />
                <PasskeySection enabled={passkeyEnabled} />
              </div>
            ),
          },
          {
            label: t('tabs.sessions'),
            icon: Monitor,
            content: <SessionsSection sessions={sessions} />,
          },
          {
            label: t('tabs.account'),
            icon: Shield,
            content: (
              <AccountSection
                email={user.email}
                linkedAccounts={linkedAccounts}
                googleEnabled={googleEnabled}
              />
            ),
          },
          ...(apiKeys
            ? [
                {
                  label: t('tabs.apiKeys'),
                  icon: Plug,
                  content: <ApiKeysSection keys={apiKeys} />,
                },
              ]
            : []),
        ]}
      />
    </div>
  )
}
