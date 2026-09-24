'use client'

import { Button, cn, Input, Label } from '@peaklab/ui'
import { Loader2, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { authButtonClass, authFieldClass } from '@/features/auth/auth-styles'
import { PasswordInput } from '@/features/auth/password-input'
import { useRouter } from '@/i18n/routing'
import { signIn } from '@/lib/auth-client'
import { toast, toastActionError } from '@/lib/toast'
import { acceptInvitationAction } from '../_lib/accept-invitation-action'

interface Props {
  token: string
  email: string
}

const MIN_PASSWORD_LENGTH = 8

export function AcceptInvitationForm({ token, email }: Props) {
  const t = useTranslations('dashboard.pages.users.invite.accept')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const password = formData.get('password') as string
      const result = await acceptInvitationAction({
        token,
        name: formData.get('name') as string,
        password,
      })
      if (result === 'OK') {
        const { error } = await signIn.email({ email, password })
        if (error) {
          toast.error(t('errors.signInFailed'))
          return
        }

        toast.success(t('success'))
        router.push('/dashboard')
      } else {
        toastActionError(t, result)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <dl className="space-y-2">
        <dt className="text-sm font-medium text-foreground">{t('email')}</dt>
        <dd className="flex h-11 items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-3 text-sm text-foreground">
          <Mail aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{email}</span>
        </dd>
      </dl>
      {/* Indice pour le gestionnaire de mots de passe : l'identifiant du compte créé. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />

      <div className="space-y-2">
        <Label htmlFor="accept-name">{t('name')}</Label>
        <Input
          id="accept-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          readOnly={isPending}
          placeholder={t('namePlaceholder')}
          className={authFieldClass}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="accept-password">{t('password')}</Label>
        <PasswordInput
          id="accept-password"
          name="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          readOnly={isPending}
          aria-describedby="accept-password-hint"
          className={authFieldClass}
        />
        <p id="accept-password-hint" className="text-xs text-muted-foreground">
          {t('passwordHint', { min: MIN_PASSWORD_LENGTH })}
        </p>
      </div>

      <Button type="submit" disabled={isPending} className={cn(authButtonClass, 'shadow-xs')}>
        {isPending && <Loader2 aria-hidden className="size-4 animate-spin" />}
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  )
}
