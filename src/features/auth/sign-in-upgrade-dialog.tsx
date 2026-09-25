'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  useDialog,
} from '@peaklab/ui'
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser'
import { KeyRound } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
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

type Pending = 'google' | 'passkey' | null

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
 * Proposée à l'arrivée sur le tableau de bord après une connexion par mot de passe. Le gate
 * (`app/[locale]/(dashboard)/_components/sign-in-upgrade-gate.tsx`) a déjà écarté l'emprunt
 * d'identité, le refus enregistré, un compte Google lié ou une passkey existante.
 */
export function SignInUpgradeDialog({ offer, googleLinked }: Props) {
  const t = useTranslations('dashboard.signInUpgrade')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const webAuthnAvailable = useWebAuthnAvailable()

  const returned = searchParams.get(RETURN_PARAM)
  const linkedMessage = t('googleLinked')

  // Retour de Google : le paramètre est consommé puis retiré de l'URL, pour qu'un
  // rechargement ne rejoue ni le toast ni l'erreur.
  useEffect(() => {
    if (!returned) return
    if (returned === 'google' && googleLinked) toast.success(linkedMessage)
    router.replace(pathname)
  }, [returned, googleLinked, linkedMessage, pathname, router])

  if (!offer) return null

  const showGoogle = offer.google
  // Sans WebAuthn la passkey disparaît ; hors Gmail il ne reste alors rien à proposer, et le
  // silence ne vaut pas refus : rien n'est enregistré.
  const showPasskey = offer.passkey && webAuthnAvailable
  if (!showGoogle && !showPasskey) return null

  return (
    <Dialog initialOpen>
      <SignInUpgradeDialogContent
        showGoogle={showGoogle}
        showPasskey={showPasskey}
        initialError={returned === 'google-error' ? 'linkFailed' : null}
      />
    </Dialog>
  )
}

type ContentProps = {
  showGoogle: boolean
  showPasskey: boolean
  initialError: string | null
}

function SignInUpgradeDialogContent({ showGoogle, showPasskey, initialError }: ContentProps) {
  const t = useTranslations('dashboard.signInUpgrade')
  const locale = useLocale()
  const router = useRouter()
  const { open, setOpen } = useDialog()
  const nameId = useId()
  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<string | null>(initialError)
  const [passkeyName, setPasskeyName] = useState(() => t('passkeyDefaultName'))
  // `true` après un succès : la fermeture qui suit n'est pas un « Plus tard ».
  const succeeded = useRef(false)

  // « Plus tard », Échap et clic sur le fond passent tous par `setOpen(false)` de la
  // primitive : observer la fermeture couvre les trois sans dupliquer la gestion clavier.
  useEffect(() => {
    if (open || succeeded.current) return
    void dismissSignInUpgradeAction()
  }, [open])

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

  const handlePasskey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = passkeyName.trim()
    if (!name) {
      setError('nameRequired')
      return
    }

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
      // Annulation ou refus de la cérémonie : le dialogue reste, rien n'est enregistré.
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

    succeeded.current = true
    toast.success(t('passkeyRegistered'))
    setOpen(false)
    // Le gate relit le compte : avec une passkey il n'a plus rien à proposer.
    router.refresh()
  }

  const errorMessage = error
    ? t.has(`errors.${error}`)
      ? t(`errors.${error}`)
      : t('errors.passkeyFailed')
    : null

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="text-sm text-graphite-600">
          {showGoogle ? t('descriptionGoogle') : t('descriptionPasskey')}
        </p>

        {errorMessage && (
          <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        {showGoogle && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={pending !== null}
            aria-busy={pending === 'google'}
          >
            <GoogleIcon className="size-4" />
            {pending === 'google' ? t('googlePending') : t('continueWithGoogle')}
          </Button>
        )}

        {showGoogle && showPasskey && (
          <p className="text-center text-xs uppercase tracking-wide text-graphite-600">{t('or')}</p>
        )}

        {showPasskey && (
          <form onSubmit={handlePasskey} className="space-y-3">
            <div>
              <Label htmlFor={nameId}>{t('passkeyName')}</Label>
              <Input
                id={nameId}
                value={passkeyName}
                onChange={(event) => setPasskeyName(event.target.value)}
                className="mt-1"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={pending !== null}
              aria-busy={pending === 'passkey'}
            >
              <KeyRound aria-hidden className="size-4" />
              {pending === 'passkey' ? t('passkeyPending') : t('createPasskey')}
            </Button>
          </form>
        )}
      </DialogBody>
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending !== null}
        >
          {t('later')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
