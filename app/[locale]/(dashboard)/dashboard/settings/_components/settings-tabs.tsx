'use client'

import { KeyRound, Monitor, Shield, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { cn } from '@/lib/utils'
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

const tabs = [
  { key: 'profile', icon: User },
  { key: 'security', icon: KeyRound },
  { key: 'sessions', icon: Monitor },
  { key: 'account', icon: Shield },
] as const

type TabKey = (typeof tabs)[number]['key']

export function SettingsTabs({ user, sessions, linkedProviders }: Props) {
  const t = useTranslations('settings')
  const [activeTab, setActiveTab] = useState<TabKey>('profile')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-px">
        {tabs.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            )}
          >
            <Icon size={16} />
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && <ProfileSection user={user} />}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <PasswordSection />
          <PasskeySection />
        </div>
      )}
      {activeTab === 'sessions' && <SessionsSection sessions={sessions} />}
      {activeTab === 'account' && (
        <AccountSection email={user.email} linkedProviders={linkedProviders} />
      )}
    </div>
  )
}
