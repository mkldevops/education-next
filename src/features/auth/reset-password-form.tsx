'use client'

import { Button, buttonVariants, cn, Label } from '@peaklab/ui'
import { CircleCheck, Link2Off, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Link } from '@/i18n/routing'
import { resetPassword } from '@/lib/auth-client'
import { AuthHeading } from './auth-heading'
import { authButtonClass, authFieldClass } from './auth-styles'
import { BackToLoginLink } from './back-to-login-link'
import { FormAlert } from './form-alert'
import { PasswordInput } from './password-input'

interface ResetPasswordFormProps {
  token: string | undefined
}

const MIN_PASSWORD_LENGTH = 8

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations('auth.resetPassword')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const primaryLink = cn(buttonVariants(), authButtonClass, 'shadow-xs')

  if (!token) {
    return (
      <div className="space-y-8">
        <AuthHeading
          icon={<Link2Off />}
          tone="warning"
          title={t('invalidTitle')}
          description={t('invalidToken')}
        />
        <div className="space-y-4">
          <Link href="/forgot-password" className={primaryLink}>
            {t('requestNewLink')}
          </Link>
          <BackToLoginLink label={t('backToLogin')} />
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="space-y-8">
        <AuthHeading
          icon={<CircleCheck />}
          tone="success"
          title={t('successTitle')}
          description={t('success')}
        />
        <Link href="/login" className={primaryLink}>
          {t('signIn')}
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isLoading) return
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
    <div className="space-y-8">
      <AuthHeading title={t('title')} description={t('subtitle')} />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <FormAlert>{error}</FormAlert>}

        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            aria-describedby="password-hint"
            className={authFieldClass}
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            {t('passwordHint', { min: MIN_PASSWORD_LENGTH })}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
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
