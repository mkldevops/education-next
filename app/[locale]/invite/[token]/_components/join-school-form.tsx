'use client'

import { Button, Card } from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { joinSchoolAction } from '../_lib/join-school-action'

type Props = {
  token: string
  email: string
  schoolName: string
  signedInAs?: string
}

/**
 * Acceptation par un compte existant.
 *
 * Aucun champ de mot de passe : le seul acte est le rattachement, et l'identité vient
 * de la session. Sans session, ou sous une autre adresse, l'écran renvoie vers la
 * connexion plutôt que de proposer une action que le serveur refusera.
 */
export function JoinSchoolForm({ token, email, schoolName, signedInAs }: Props) {
  const t = useTranslations('schools.join')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const matches = signedInAs?.toLowerCase() === email.toLowerCase()

  const handleJoin = () => {
    startTransition(async () => {
      const result = await joinSchoolAction({ token })
      if (result !== 'OK') {
        toastActionError(t, result)
        return
      }
      toast.success(t('success', { schoolName }))
      router.push('/dashboard')
    })
  }

  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">{t('title', { schoolName })}</h1>
      <p className="mt-2 text-sm text-gray-600">{t('description', { email })}</p>

      {matches ? (
        <Button type="button" onClick={handleJoin} disabled={isPending} className="mt-6 w-full">
          {isPending ? '...' : t('submit', { schoolName })}
        </Button>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {signedInAs ? t('wrongAccount', { signedInAs, email }) : t('signInRequired', { email })}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/login')}
            className="w-full"
          >
            {t('signIn')}
          </Button>
        </div>
      )}
    </Card>
  )
}
