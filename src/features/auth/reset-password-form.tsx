'use client'

import { Button, Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Link } from '@/i18n/routing'
import { resetPassword } from '@/lib/auth-client'

interface ResetPasswordFormProps {
  token: string | undefined
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations('auth.resetPassword')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  if (!token) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{t('invalidToken')}</div>
        <Link
          href="/login"
          className="block text-center text-sm text-primary hover:text-primary-hover"
        >
          {t('backToLogin')}
        </Link>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">{t('success')}</div>
        <Link
          href="/login"
          className="block text-center text-sm text-primary hover:text-primary-hover"
        >
          {t('backToLogin')}
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const newPassword = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'))
      setIsLoading(false)
      return
    }

    try {
      const { error } = await resetPassword({ token, newPassword })

      if (error) {
        setError(t('error'))
      } else {
        setIsSuccess(true)
      }
    } catch {
      setError(t('error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      <div>
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? '...' : t('submit')}
      </Button>

      <div className="text-center">
        <Link href="/login" className="text-sm text-primary hover:text-primary-hover">
          {t('backToLogin')}
        </Link>
      </div>
    </form>
  )
}
