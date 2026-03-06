'use client'

import { Button, Card, Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { deleteProfileAction, updateProfileAction } from '@/actions'
import { useRouter } from '@/i18n/routing'
import { useSession } from '@/lib/auth-client'

export default function SettingsPage() {
  const t = useTranslations('settings')
  const router = useRouter()
  const { data: session } = useSession()
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string

    startTransition(async () => {
      const result = await updateProfileAction({ name })

      if (result.success) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(result.error)
      }
    })
  }

  const handleDelete = () => {
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">{t('profile.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('profile.description')}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {success && (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-600">
              {t('profile.success')}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {t(`errors.${error}`)}
            </div>
          )}

          <div>
            <Label htmlFor="name">{t('profile.name')}</Label>
            <Input
              id="name"
              name="name"
              defaultValue={session?.user?.name || ''}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="email">{t('profile.email')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={session?.user?.email || ''}
              disabled
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">{t('profile.emailHint')}</p>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? '...' : t('profile.save')}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">{t('security.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('security.description')}</p>

        <div className="mt-6">
          <Button variant="outline">{t('security.changePassword')}</Button>
        </div>
      </Card>

      <Card className="border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-600">{t('danger.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('danger.description')}</p>

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
