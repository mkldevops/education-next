'use client'

import { Button, Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Link } from '@/i18n/routing'
import { requestPasswordReset } from '@/lib/auth-client'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await requestPasswordReset({ email, redirectTo: '/reset-password' })

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

  if (isSuccess) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="overflow-hidden rounded bg-white shadow-lg">
            <div className="bg-[var(--color-primary)] px-8 py-6 text-center">
              <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
              <p className="mt-1 text-sm text-white/80">{t('subtitle')}</p>
            </div>
            <div className="px-8 py-8 text-center">
              <div className="rounded bg-green-50 p-6">
                <h2 className="text-lg font-medium text-green-800">{t('successTitle')}</h2>
                <p className="mt-2 text-sm text-green-600">{t('successMessage')}</p>
              </div>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm text-primary hover:text-primary-hover"
              >
                {t('backToLogin')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded bg-white shadow-lg">
          <div className="bg-[var(--color-primary)] px-8 py-6 text-center">
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
            <p className="mt-1 text-sm text-white/80">{t('subtitle')}</p>
          </div>
          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && <div className="rounded bg-red-50 p-4 text-sm text-red-600">{error}</div>}

              <div>
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? '...' : t('submit')}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
                {t('backToLogin')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
