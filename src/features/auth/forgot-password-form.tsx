'use client'

import { Button, Input, Label } from '@peaklab/ui'
import { Loader2, MailCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { requestPasswordReset } from '@/lib/auth-client'
import { AuthHeading } from './auth-heading'
import { authButtonClass, authFieldClass, authLinkClass } from './auth-styles'
import { BackToLoginLink } from './back-to-login-link'
import { FormAlert } from './form-alert'

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isResent, setIsResent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendLink = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await requestPasswordReset({ email, redirectTo: '/reset-password' })
      if (error) {
        setError(t('error'))
        return false
      }
      return true
    } catch {
      setError(t('error'))
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (await sendLink()) setIsSuccess(true)
  }

  const handleResend = async () => {
    setIsResent(false)
    if (await sendLink()) setIsResent(true)
  }

  if (isSuccess) {
    return (
      <div className="space-y-8">
        <AuthHeading
          icon={<MailCheck />}
          tone="success"
          title={t('successTitle')}
          description={t.rich('successMessage', {
            email,
            strong: (chunks) => <strong className="font-medium text-foreground">{chunks}</strong>,
          })}
        />

        {error && <FormAlert>{error}</FormAlert>}
        {isResent && <FormAlert tone="success">{t('resent')}</FormAlert>}

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className={`${authButtonClass} bg-surface shadow-xs`}
            onClick={handleResend}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {isLoading ? t('submitting') : t('resend')}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t('wrongEmail')}{' '}
            <button
              type="button"
              className={authLinkClass}
              onClick={() => {
                setIsSuccess(false)
                setIsResent(false)
                setError(null)
              }}
            >
              {t('changeEmail')}
            </button>
          </p>
        </div>

        <div className="border-t border-border pt-6">
          <BackToLoginLink label={t('backToLogin')} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <AuthHeading title={t('title')} description={t('subtitle')} />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <FormAlert>{error}</FormAlert>}

        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authFieldClass}
          />
        </div>

        <Button
          type="submit"
          className={`${authButtonClass} shadow-xs`}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {isLoading ? t('submitting') : t('submit')}
        </Button>
      </form>

      <div className="border-t border-border pt-6">
        <BackToLoginLink label={t('backToLogin')} />
      </div>
    </div>
  )
}
