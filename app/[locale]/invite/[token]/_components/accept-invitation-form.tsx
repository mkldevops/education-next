'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input/input'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
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
      const result = await acceptInvitationAction({
        token,
        name: formData.get('name') as string,
        password: formData.get('password') as string,
      })
      if (result === 'OK') {
        toast.success('Compte créé avec succès !')
        router.push('/dashboard')
      } else if (result === 'expired') {
        toast.error("Ce lien d'invitation a expiré.")
      } else if (result === 'alreadyUsed') {
        toast.error('Ce lien a déjà été utilisé.')
      } else {
        toast.error('Une erreur est survenue.')
      }
    })
  }

  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accept-email">Email</Label>
          <Input
            id="accept-email"
            type="email"
            value={email}
            readOnly
            disabled
            className="bg-gray-50"
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
            placeholder="Jean Dupont"
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
