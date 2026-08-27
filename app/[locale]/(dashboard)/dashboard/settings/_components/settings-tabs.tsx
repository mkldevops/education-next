'use client'

import { Tabs } from '@peaklab/ui'
import { KeyRound, Monitor, Shield, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AccountSection } from './account-section'
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

type Props = {
  user: {
    name: string
    email: string
    image: string | null
  }
  sessions: SessionData[]
  linkedProviders: string[]
}

export function SettingsTabs({ user, sessions, linkedProviders }: Props) {
  const t = useTranslations('settings')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

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
                <PasskeySection />
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
            content: <AccountSection email={user.email} linkedProviders={linkedProviders} />,
          },
        ]}
      />
    </div>
  )
}
