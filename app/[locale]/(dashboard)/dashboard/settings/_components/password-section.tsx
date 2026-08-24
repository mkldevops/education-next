'use client'

import { Button, Card, Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import { changePasswordAction } from '@/actions'

export function PasswordSection() {
  const t = useTranslations('settings')
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    const currentPassword = formData.get('currentPassword') as string
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (newPassword !== confirmPassword) {
      setError('passwordMismatch')
      return
    }

    if (newPassword.length < 8) {
      setError('passwordTooShort')
      return
    }

    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      })

      if (result.success) {
        setSuccess(true)
        formRef.current?.reset()
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-gray-900">{t('security.title')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t('security.description')}</p>

      <form ref={formRef} onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
        {success && (
          <div className="rounded bg-green-50 p-3 text-sm text-green-600">
            {t('security.success')}
          </div>
        )}

        {error && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-600">{t(`errors.${error}`)}</div>
        )}

        <div>
          <Label htmlFor="currentPassword">{t('security.currentPassword')}</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            className="mt-1"
            required
          />
        </div>

        <div>
          <Label htmlFor="newPassword">{t('security.newPassword')}</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            className="mt-1"
            required
            minLength={8}
          />
          <p className="mt-1 text-xs text-gray-500">{t('security.passwordHint')}</p>
        </div>

        <div>
          <Label htmlFor="confirmPassword">{t('security.confirmPassword')}</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            className="mt-1"
            required
          />
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? '...' : t('security.changePassword')}
        </Button>
      </form>
    </Card>
  )
}
