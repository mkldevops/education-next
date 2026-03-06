'use client'

import { Button, Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Link, useRouter } from '@/i18n/routing'
import { signIn } from '@/lib/auth-client'

export function LoginForm() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const { error } = await signIn.email({ email, password })

      if (error) {
        setError(t('error'))
      } else {
        router.push('/dashboard')
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
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1"
        />
      </div>

      <div className="flex items-center justify-between">
        <Link href="/forgot-password" className="text-sm text-primary hover:text-primary-hover">
          {t('forgotPassword')}
        </Link>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? '...' : t('submit')}
      </Button>
    </form>
  )
}
