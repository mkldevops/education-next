'use client'

import { Button, Card, Input, Label } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { signIn } from '@/lib/auth-client'
import { toast, toastActionError } from '@/lib/toast'
import { acceptInvitationAction } from '../_lib/accept-invitation-action'

interface Props {
  token: string
  email: string
}

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
    <Card className="p-8">
      <h1 className="text-2xl font-bold text-graphite">{t('title')}</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accept-email">{t('email')}</Label>
          <Input
            id="accept-email"
            type="email"
            value={email}
            readOnly
            disabled
            className="bg-alabaster-900"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accept-name">{t('name')}</Label>
          <Input
            id="accept-name"
            name="name"
            type="text"
            required
            disabled={isPending}
            placeholder={t('namePlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accept-password">{t('password')}</Label>
          <Input
            id="accept-password"
            name="password"
            type="password"
            required
            minLength={8}
            disabled={isPending}
          />
        </div>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? '...' : t('submit')}
        </Button>
      </form>
    </Card>
  )
}
