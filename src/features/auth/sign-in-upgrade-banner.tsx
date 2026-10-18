'use client'

import { Button } from '@peaklab/ui'
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser'
import { KeyRound } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  dismissSignInUpgradeAction,
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
} from '@/actions'
import type { SignInUpgradeOffer } from '@/domain/sign-in-upgrade'
import { linkSocial } from '@/lib/auth-client'
import { toast } from '@/lib/toast'
import { GoogleIcon } from './google-icon'

/** Paramètre de retour de la liaison Google, posé par `callbackURL` / `errorCallbackURL`. */
const RETURN_PARAM = 'signInUpgrade'

type Props = {
  /** `null` : rien à proposer ; le composant ne sert alors qu'au retour de Google. */
  offer: SignInUpgradeOffer | null
  /** Un compte Google est lié : seul cas où le retour `?signInUpgrade=google` mérite un toast. */
  googleLinked: boolean
}

type Pending = 'google' | 'passkey' | 'later' | null

const subscribeNoop = () => () => {}

/**
 * `false` au rendu serveur et à l'hydratation, puis l'état réel du navigateur : la présence de
 * `PublicKeyCredential` ne se lit qu'après coup, sans quoi le balisage serveur et client
 * divergeraient.
 */
function useWebAuthnAvailable() {
  return useSyncExternalStore(subscribeNoop, browserSupportsWebAuthn, () => false)
}

/**
 * Bandeau proposé en haut du tableau de bord après une connexion par mot de passe, sans bloquer
 * la page. Le gate (`app/[locale]/(dashboard)/_components/sign-in-upgrade-gate.tsx`) a déjà
 * écarté l'emprunt d'identité, le refus enregistré, un compte Google lié ou une passkey existante.
 */
export function SignInUpgradeBanner({ offer, googleLinked }: Props) {
  const t = useTranslations('dashboard.signInUpgrade')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const webAuthnAvailable = useWebAuthnAvailable()
  // Masqué localement après « Plus tard » ou un succès, sans attendre le rendu serveur suivant.
  const [hidden, setHidden] = useState(false)

  const returned = searchParams.get(RETURN_PARAM)
  const linkedMessage = t('googleLinked')

  // Retour de Google : le paramètre est consommé puis retiré de l'URL, pour qu'un
  // rechargement ne rejoue ni le toast ni l'erreur.
  useEffect(() => {
    if (!returned) return
    if (returned === 'google' && googleLinked) toast.success(linkedMessage)
    router.replace(pathname)
  }, [returned, googleLinked, linkedMessage, pathname, router])

  if (!offer || hidden) return null

  const showGoogle = offer.google
  // Sans WebAuthn la passkey disparaît ; hors Gmail il ne reste alors rien à proposer, et le
  // silence ne vaut pas refus : rien n'est enregistré.
  const showPasskey = offer.passkey && webAuthnAvailable
  if (!showGoogle && !showPasskey) return null

  return (
    <SignInUpgradeBannerContent
      showGoogle={showGoogle}
      showPasskey={showPasskey}
      initialError={returned === 'google-error' ? 'linkFailed' : null}
      onDone={() => setHidden(true)}
    />
  )
}

type ContentProps = {
  showGoogle: boolean
  showPasskey: boolean
  initialError: string | null
  onDone: () => void
}

function SignInUpgradeBannerContent({
  showGoogle,
  showPasskey,
  initialError,
  onDone,
}: ContentProps) {
  const t = useTranslations('dashboard.signInUpgrade')
  const locale = useLocale()
  const router = useRouter()
  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<string | null>(initialError)

  const handleLater = async () => {
    setPending('later')
    await dismissSignInUpgradeAction()
    onDone()
  }

  const handleGoogle = async () => {
    setError(null)
    setPending('google')
    const result = await linkSocial({
      provider: 'google',
      callbackURL: `/${locale}/dashboard?${RETURN_PARAM}=google`,
      errorCallbackURL: `/${locale}/dashboard?${RETURN_PARAM}=google-error`,
    })
    if (result.error) {
      setError(result.error.code === 'impersonating' ? 'impersonating' : 'linkFailed')
      setPending(null)
    }
  }

  const handlePasskey = async () => {
    // Pas de champ de nom dans un bandeau : la clé prend le nom par défaut.
    const name = t('passkeyDefaultName')
    setError(null)
    setPending('passkey')

    const registration = await getPasskeyRegistrationOptions(name)
    if ('error' in registration) {
      setError(registration.error ?? 'passkeyFailed')
      setPending(null)
      return
    }

    let response: Awaited<ReturnType<typeof startRegistration>>
    try {
      response = await startRegistration({ optionsJSON: registration.options })
    } catch {
      // Annulation ou refus de la cérémonie : le bandeau reste, rien n'est enregistré.
      setError('cancelled')
      setPending(null)
      return
    }

    const verified = await verifyPasskeyRegistration(response, name)
    if (verified !== 'OK') {
      setError(verified)
      setPending(null)
      return
    }

    toast.success(t('passkeyRegistered'))
    onDone()
    // Le gate relit le compte : avec une passkey il n'a plus rien à proposer.
    router.refresh()
  }

  const errorMessage = error
    ? t.has(`errors.${error}`)
      ? t(`errors.${error}`)
      : t('errors.passkeyFailed')
    : null

  return (
    <section
      aria-label={t('title')}
      className="border-b border-primary/20 bg-primary-light px-4 py-2 text-sm text-graphite sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <KeyRound aria-hidden className="size-4 shrink-0 text-primary" />
          <p className="min-w-0">
            <span className="font-medium">{t('title')}</span>{' '}
            <span className="text-graphite-600">
              {showGoogle ? t('descriptionGoogle') : t('descriptionPasskey')}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showPasskey && (
            <Button
              size="sm"
              onClick={handlePasskey}
              disabled={pending !== null}
              aria-busy={pending === 'passkey'}
            >
              <KeyRound aria-hidden className="size-4" />
              {pending === 'passkey' ? t('passkeyPending') : t('createPasskey')}
            </Button>
          )}
          {showGoogle && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGoogle}
              disabled={pending !== null}
              aria-busy={pending === 'google'}
            >
              <GoogleIcon className="size-4" />
              {pending === 'google' ? t('googlePending') : t('continueWithGoogle')}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLater}
            disabled={pending !== null}
            aria-busy={pending === 'later'}
          >
            {t('later')}
          </Button>
        </div>
      </div>
      {errorMessage && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {errorMessage}
        </p>
      )}
    </section>
  )
}
