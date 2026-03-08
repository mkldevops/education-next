'use client'

import { Button, Card, Input, Label } from '@peaklab/ui'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { deleteProfileAction } from '@/actions'
import { useRouter as useI18nRouter } from '@/i18n/routing'
import { linkSocial, signOut, unlinkAccount } from '@/lib/auth-client'

type Props = {
  email: string
  linkedProviders: string[]
}

export function AccountSection({ email, linkedProviders }: Props) {
  const t = useTranslations('settings')
  const router = useRouter()
  const i18nRouter = useI18nRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const locale = useLocale()
  const [providers, setProviders] = useState(linkedProviders)

  const isGoogleLinked = providers.includes('google')

  const handleLinkGoogle = () => {
    startTransition(async () => {
      await linkSocial({
        provider: 'google',
        callbackURL: `/${locale}/dashboard/settings`,
      })
    })
  }

  const handleUnlinkGoogle = () => {
    startTransition(async () => {
      const result = await unlinkAccount({ providerId: 'google' })
      if (!result.error) {
        setProviders((prev) => prev.filter((p) => p !== 'google'))
        router.refresh()
      }
    })
  }

  const handleDelete = () => {
    setError(null)

    startTransition(async () => {
      const result = await deleteProfileAction()

      if (result.success) {
        i18nRouter.push('/')
      } else {
        setError(result.error)
        setShowDeleteConfirm(false)
      }
    })
  }

  const handleLogout = () => {
    startTransition(async () => {
      await signOut()
      i18nRouter.push('/')
    })
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">{t('account.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('account.description')}</p>

        <div className="mt-6 max-w-md">
          <Label htmlFor="account-email">{t('profile.email')}</Label>
          <Input id="account-email" type="email" defaultValue={email} disabled className="mt-1" />
          <p className="mt-1 text-xs text-gray-500">{t('profile.emailHint')}</p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">{t('connectedAccounts.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('connectedAccounts.description')}</p>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24" role="img" aria-label="Google">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">Google</p>
                <p className="text-xs text-gray-500">
                  {isGoogleLinked
                    ? t('connectedAccounts.connected')
                    : t('connectedAccounts.notConnected')}
                </p>
              </div>
            </div>
            {isGoogleLinked ? (
              <Button variant="outline" size="sm" onClick={handleUnlinkGoogle} disabled={isPending}>
                {t('connectedAccounts.disconnect')}
              </Button>
            ) : (
              <Button size="sm" onClick={handleLinkGoogle} disabled={isPending}>
                {t('connectedAccounts.connect')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="border-orange-200 p-6">
        <h2 className="text-lg font-semibold text-orange-600">{t('logout.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('logout.description')}</p>

        <div className="mt-6">
          {showLogoutConfirm ? (
            <div className="space-y-4">
              <p className="text-sm text-orange-600">{t('logout.confirmMessage')}</p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleLogout} disabled={isPending}>
                  {isPending ? '...' : t('logout.confirm')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowLogoutConfirm(false)}
                  disabled={isPending}
                >
                  {t('logout.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setShowLogoutConfirm(true)}>
              {t('logout.button')}
            </Button>
          )}
        </div>
      </Card>

      <Card className="border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-600">{t('danger.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('danger.description')}</p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {t(`errors.${error}`)}
          </div>
        )}

        <div className="mt-6">
          {showDeleteConfirm ? (
            <div className="space-y-4">
              <p className="text-sm text-red-600">{t('danger.confirmMessage')}</p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                  {isPending ? '...' : t('danger.confirmDelete')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isPending}
                >
                  {t('danger.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              {t('danger.deleteAccount')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
