'use client'

import { Button, Input, Label } from '@peaklab/ui'
import { startAuthentication } from '@simplewebauthn/browser'
import { KeyRound, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { getPasskeyAuthenticationOptions } from '@/actions'
import { Link, useRouter } from '@/i18n/routing'
import { signIn } from '@/lib/auth-client'
import { authButtonClass, authFieldClass, authLinkClass } from './auth-styles'
import { FormAlert } from './form-alert'
import { GoogleIcon } from './google-icon'
import { PasswordInput } from './password-input'
import { DEFAULT_AUTH_REDIRECT } from './safe-redirect'

type Props = {
  googleEnabled: boolean
  passkeyEnabled: boolean
  /** Chemin interne déjà assaini par la page (`safeRedirectPath`). */
  redirectTo?: string
}

type PendingMethod = 'password' | 'google' | 'passkey'

const Spinner = () => <Loader2 aria-hidden className="size-4 animate-spin" />

export function LoginForm({
  googleEnabled,
  passkeyEnabled,
  redirectTo = DEFAULT_AUTH_REDIRECT,
}: Props) {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingMethod | null>(null)

  const hasAlternatives = googleEnabled || passkeyEnabled

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setPending('password')

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const { error } = await signIn.email({ email, password })

      if (error) {
        setError(error.status && error.status >= 500 ? t('serviceUnavailable') : t('error'))
      } else {
        router.push(redirectTo)
      }
    } catch {
      setError(t('error'))
    } finally {
      setPending(null)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setPending('google')

    try {
      const { error } = await signIn.social({ provider: 'google', callbackURL: redirectTo })
      if (error) setError(t('googleError'))
    } catch {
      setError(t('googleError'))
    } finally {
      setPending(null)
    }
  }

  const handlePasskeySignIn = async () => {
    setError(null)
    setPending('passkey')

    try {
      const optionsData = await getPasskeyAuthenticationOptions()
      if ('error' in optionsData) {
        setError(t('passkeyError'))
        return
      }

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

      router.push(redirectTo)
    } catch {
      setError(t('passkeyError'))
    } finally {
      setPending(null)
    }
  }

  const isBusy = pending !== null

  return (
    <div className="space-y-6">
      {error && <FormAlert>{error}</FormAlert>}

      {hasAlternatives && (
        <div className="grid gap-3">
          {googleEnabled && (
            <Button
              type="button"
              variant="outline"
              className={`${authButtonClass} bg-surface shadow-xs`}
              onClick={handleGoogleSignIn}
              disabled={isBusy}
              aria-busy={pending === 'google'}
            >
              {pending === 'google' ? <Spinner /> : <GoogleIcon className="size-4" />}
              {pending === 'google' ? t('googlePending') : t('signInWithGoogle')}
            </Button>
          )}

          {passkeyEnabled && (
            <Button
              type="button"
              variant="outline"
              className={`${authButtonClass} bg-surface shadow-xs`}
              onClick={handlePasskeySignIn}
              disabled={isBusy}
              aria-busy={pending === 'passkey'}
            >
              {pending === 'passkey' ? <Spinner /> : <KeyRound aria-hidden className="size-4" />}
              {pending === 'passkey' ? t('passkeyPending') : t('signInWithPasskey')}
            </Button>
          )}
        </div>
      )}

      {hasAlternatives && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span aria-hidden className="h-px flex-1 bg-border" />
          <span>{t('or')}</span>
          <span aria-hidden className="h-px flex-1 bg-border" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            spellCheck={false}
            placeholder={t('emailPlaceholder')}
            required
            className={authFieldClass}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            className={authFieldClass}
          />
          <div className="flex justify-end">
            <Link href="/forgot-password" className={`text-sm ${authLinkClass}`}>
              {t('forgotPassword')}
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          className={`${authButtonClass} shadow-xs`}
          disabled={isBusy}
          aria-busy={pending === 'password'}
        >
          {pending === 'password' && <Spinner />}
          {pending === 'password' ? t('submitting') : t('submit')}
        </Button>
      </form>
    </div>
  )
}
