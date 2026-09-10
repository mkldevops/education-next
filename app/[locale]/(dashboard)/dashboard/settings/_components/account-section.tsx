'use client'

import { Button, Card, Input, Label } from '@peaklab/ui'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { deleteProfileAction } from '@/actions'
import { GoogleIcon } from '@/features/auth'
import { useRouter as useI18nRouter } from '@/i18n/routing'
import { linkSocial, signOut, unlinkAccount } from '@/lib/auth-client'
import { toast } from '@/lib/toast'

type LinkedAccount = {
  id: string
  providerId: string
}

type Props = {
  email: string
  linkedAccounts: LinkedAccount[]
  googleEnabled?: boolean
}

export function AccountSection({ email, linkedAccounts, googleEnabled = false }: Props) {
  const t = useTranslations('settings')
  const router = useRouter()
  const i18nRouter = useI18nRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const locale = useLocale()
  const [accounts, setAccounts] = useState(linkedAccounts)

  const googleAccount = accounts.find((a) => a.providerId === 'google')

  const handleLinkGoogle = () => {
    setError(null)
    startTransition(async () => {
      const result = await linkSocial({
        provider: 'google',
        callbackURL: `/${locale}/dashboard/settings`,
      })
      if (result.error) {
        setError('linkFailed')
      }
    })
  }

  const handleUnlinkGoogle = () => {
    setError(null)
    startTransition(async () => {
      if (!googleAccount) {
        setError('unlinkFailed')
        return
      }

      const result = await unlinkAccount({ accountId: googleAccount.id })
      if (result.error) {
        setError('unlinkFailed')
      } else {
        setAccounts((prev) => prev.filter((a) => a.id !== googleAccount.id))
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
      const { error: signOutError } = await signOut()
      if (signOutError) {
        toast.error(t('errors.logoutFailed'))
        return
      }
      i18nRouter.push('/')
    })
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-graphite">{t('account.title')}</h2>
        <p className="mt-1 text-sm text-graphite-600">{t('account.description')}</p>

        <div className="mt-6 max-w-md">
          <Label htmlFor="account-email">{t('profile.email')}</Label>
          <Input id="account-email" type="email" defaultValue={email} disabled className="mt-1" />
          <p className="mt-1 text-xs text-graphite-600">{t('profile.emailHint')}</p>
        </div>
      </Card>

      {(googleEnabled || googleAccount) && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-graphite">{t('connectedAccounts.title')}</h2>
          <p className="mt-1 text-sm text-graphite-600">{t('connectedAccounts.description')}</p>

          {error && (error === 'linkFailed' || error === 'unlinkFailed') && (
            <div className="mt-3 rounded bg-red-50 p-3 text-sm text-red-600">
              {t(`errors.${error}`)}
            </div>
          )}

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded border border-alabaster-700 p-4">
              <div className="flex items-center gap-3">
                <GoogleIcon />
                <div>
                  <p className="text-sm font-medium text-graphite">Google</p>
                  <p className="text-xs text-graphite-600">
                    {googleAccount
                      ? t('connectedAccounts.connected')
                      : t('connectedAccounts.notConnected')}
                  </p>
                </div>
              </div>
              {googleAccount ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlinkGoogle}
                  disabled={isPending}
                >
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
      )}

      <Card className="border-orange-200 p-6">
        <h2 className="text-lg font-semibold text-orange-600">{t('logout.title')}</h2>
        <p className="mt-1 text-sm text-graphite-600">{t('logout.description')}</p>

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
        <p className="mt-1 text-sm text-graphite-600">{t('danger.description')}</p>

        {error && (
          <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-600">
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
