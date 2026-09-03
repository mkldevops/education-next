'use client'

import { Button, Input, Label } from '@peaklab/ui'
import { startAuthentication } from '@simplewebauthn/browser'
import { KeyRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { getPasskeyAuthenticationOptions } from '@/actions'
import { Link, useRouter } from '@/i18n/routing'
import { signIn } from '@/lib/auth-client'

export function LoginForm() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)

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
        setError(error.status && error.status >= 500 ? t('serviceUnavailable') : t('error'))
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError(t('error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasskeySignIn = async () => {
    setError(null)
    setIsPasskeyLoading(true)

    try {
      const optionsData = await getPasskeyAuthenticationOptions()
      const { challengeId, ...options } = optionsData
      const response = await startAuthentication({ optionsJSON: options })

      const res = await fetch('/api/passkey/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...response, challengeId }),
      })

      if (!res.ok) {
        setError(t('passkeyError'))
        return
      }

      router.push('/dashboard')
    } catch {
      setError(t('passkeyError'))
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  return (
    <div className="space-y-6">
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

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-alabaster-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-graphite-600">{t('or')}</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handlePasskeySignIn}
        disabled={isPasskeyLoading}
      >
        <KeyRound className="mr-2 h-4 w-4" />
        {isPasskeyLoading ? '...' : t('signInWithPasskey')}
      </Button>
    </div>
  )
}
