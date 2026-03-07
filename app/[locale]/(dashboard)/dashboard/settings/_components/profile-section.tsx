'use client'

import { Button, Card, Input, Label } from '@peaklab/ui'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { updateProfileAction } from '@/actions'

type Props = {
  user: {
    name: string
    email: string
    image: string | null
  }
}

export function ProfileSection({ user }: Props) {
  const t = useTranslations('settings')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string

    startTransition(async () => {
      const result = await updateProfileAction({ name })

      if (result.success) {
        setSuccess(true)
        router.refresh()
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-gray-900">{t('profile.title')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t('profile.description')}</p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
        {success && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
            {t('profile.success')}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {t(`errors.${error}`)}
          </div>
        )}

        <div>
          <Label htmlFor="name">{t('profile.name')}</Label>
          <Input id="name" name="name" defaultValue={user.name} className="mt-1" required />
        </div>

        <div>
          <Label htmlFor="email">{t('profile.email')}</Label>
          <Input id="email" type="email" defaultValue={user.email} disabled className="mt-1" />
          <p className="mt-1 text-xs text-gray-500">{t('profile.emailHint')}</p>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t('profile.save')}
        </Button>
      </form>
    </Card>
  )
}
