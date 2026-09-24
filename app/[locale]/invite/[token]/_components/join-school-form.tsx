'use client'

import { Button, cn } from '@peaklab/ui'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { authButtonClass } from '@/features/auth/auth-styles'
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

  // Sans session, la connexion ramène ici. Sous un autre compte, la page de connexion
  // redirigerait aussitôt : le retour n'aurait pas de sens.
  const signInHref = signedInAs
    ? '/login'
    : `/login?${new URLSearchParams({ redirectTo: `/invite/${token}` })}`

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">{t('description', { email })}</p>

      {matches ? (
        <Button
          type="button"
          onClick={handleJoin}
          disabled={isPending}
          className={cn(authButtonClass, 'shadow-xs')}
        >
          {isPending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {isPending ? t('submitting') : t('submit', { schoolName })}
        </Button>
      ) : (
        <div className="space-y-4">
          <p
            role="status"
            className="rounded-lg border border-warning/30 bg-warning-subtle px-3.5 py-3 text-sm leading-6 text-foreground"
          >
            {signedInAs ? t('wrongAccount', { signedInAs, email }) : t('signInRequired', { email })}
          </p>
          <Button
            type="button"
            onClick={() => router.push(signInHref)}
            className={cn(authButtonClass, 'shadow-xs')}
          >
            {t('signIn')}
          </Button>
        </div>
      )}
    </div>
  )
}
