'use client'

import { Card } from '@peaklab/ui'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { getProfileAction } from '@/actions'
import type { ProfileState } from '@/domain/profile'
import { useSession } from '@/lib/auth-client'

export default function ProfilePage() {
  const t = useTranslations('profile')
  const { data: session } = useSession()
  const [profile, setProfile] = useState<ProfileState | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const result = await getProfileAction()
      if (result.success) {
        setProfile(result.data)
      }
      setIsLoading(false)
    }
    loadProfile()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <Card className="p-6">
          <div className="animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 rounded-full bg-gray-200" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="h-3 w-48 rounded bg-gray-200" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const displayName = profile?.name || session?.user?.name || t('anonymous')
  const displayEmail = session?.user?.email || ''
  const displayImage = profile?.image || session?.user?.image

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      <Card className="p-6">
        <div className="flex items-center space-x-4">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={displayName}
              className="h-16 w-16 rounded-full object-cover"
              width={64}
              height={64}
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{displayName}</h2>
            <p className="text-gray-500">{displayEmail}</p>
            {profile?.bio && <p className="mt-1 text-sm text-gray-600">{profile.bio}</p>}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">{t('stats.memberSince')}</h3>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString()
              : session?.user?.createdAt
                ? new Date(session.user.createdAt).toLocaleDateString()
                : '-'}
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">{t('stats.lastUpdated')}</h3>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : '-'}
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">{t('activity.title')}</h2>
        <p className="mt-2 text-gray-500">{t('activity.empty')}</p>
      </Card>
    </div>
  )
}
