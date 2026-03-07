'use client'

import { Button, Card, Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { deleteProfileAction } from '@/actions'
import { useRouter } from '@/i18n/routing'
import { signOut } from '@/lib/auth-client'

type Props = {
  email: string
}

export function AccountSection({ email }: Props) {
  const t = useTranslations('settings')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const handleDelete = () => {
    setError(null)

    startTransition(async () => {
      const result = await deleteProfileAction()

      if (result.success) {
        router.push('/')
      } else {
        setError(result.error)
        setShowDeleteConfirm(false)
      }
    })
  }

  const handleLogout = () => {
    startTransition(async () => {
      await signOut()
      router.push('/')
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
