'use client'

import { Button, Card, Input, Label } from '@peaklab/ui'
import { startRegistration } from '@simplewebauthn/browser'
import { KeyRound, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import {
  deletePasskey,
  getPasskeyRegistrationOptions,
  getUserPasskeys,
  verifyPasskeyRegistration,
} from '@/actions'
import { formatDate } from '@/lib/date'
import { toast } from '@/lib/toast'

export type Passkey = {
  id: string
  name: string
  deviceType: string
  createdAt: Date
}

type Props = {
  /** Reflet de `passkey_sign_in_enabled` : gouverne le seul enregistrement. */
  enabled: boolean
  /** Liste rendue par le serveur : la carte est juste, dès le premier rendu. */
  initialPasskeys: Passkey[]
}

/**
 * Drapeau éteint : l'enregistrement disparaît, la liste et la suppression restent.
 * Même principe que la carte « comptes liés » (`account-section.tsx`) — désactiver une
 * méthode ne doit laisser personne avec une credential qu'il ne peut ni utiliser ni
 * retirer. `getUserPasskeys()` et `deletePasskey()` ne sont donc pas gardés par le
 * drapeau côté serveur, contrairement aux actions d'enregistrement.
 */
export function PasskeySection({ enabled, initialPasskeys }: Props) {
  const t = useTranslations('settings.passkey')
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [passkeys, setPasskeys] = useState<Passkey[]>(initialPasskeys)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Pas de chargement au montage : `page.tsx` fournit la liste initiale. Ce rafraîchissement
  // ne sert qu'après une mutation.
  const loadPasskeys = () => {
    startTransition(async () => {
      const data = await getUserPasskeys()
      setPasskeys(data)
    })
  }

  const handleRegister = () => {
    if (!newName.trim()) {
      setError(t('nameRequired'))
      return
    }

    setError(null)
    setSuccess(null)

    startTransition(async () => {
      const result = await getPasskeyRegistrationOptions(newName.trim())
      if ('error' in result) {
        setError(t('error'))
        return
      }

      let response: Awaited<ReturnType<typeof startRegistration>>
      try {
        response = await startRegistration({ optionsJSON: result.options })
      } catch {
        setError(t('cancelled'))
        return
      }

      const verifyResult = await verifyPasskeyRegistration(response, newName.trim())
      if (verifyResult !== 'OK') {
        setError(t('error'))
        return
      }

      setNewName('')
      setSuccess(t('registered'))
      loadPasskeys()
      router.refresh()
    })
  }

  const handleDelete = (passkeyId: string) => {
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      const result = await deletePasskey(passkeyId)
      if (result !== 'OK') {
        setError(t('deleteError'))
        return
      }
      // Notification plutôt que bandeau : supprimer la dernière passkey d'un drapeau éteint
      // démonte la carte dans le même rendu, et le bandeau partirait avec elle.
      toast.success(t('deleted'))
      loadPasskeys()
    })
  }

  // Plus aucune passkey à administrer et l'enregistrement fermé : la carte n'a plus
  // d'objet, exactement comme celle de Google sans compte lié.
  if (!enabled && passkeys.length === 0) return null

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <KeyRound className="h-5 w-5 text-graphite-600" />
        <div>
          <h2 className="text-lg font-semibold text-graphite">{t('title')}</h2>
          <p className="text-sm text-graphite-600">
            {enabled ? t('description') : t('descriptionDisabled')}
          </p>
        </div>
      </div>

      {error && <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {success && (
        <div className="mt-4 rounded bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      {passkeys.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-sm font-medium text-graphite">{t('registeredPasskeys')}</p>
          {passkeys.map((pk) => (
            <div
              key={pk.id}
              className="flex items-center justify-between rounded border border-alabaster-700 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-graphite">{pk.name}</p>
                <p className="text-xs text-graphite-600">
                  {pk.deviceType} — {formatDate(pk.createdAt, locale)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(pk.id)}
                disabled={isPending}
                aria-label={t('delete', { name: pk.name })}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {enabled ? (
        <div className="mt-6 flex gap-3">
          <div className="flex-1">
            <Label htmlFor="passkey-name">{t('namePlaceholder')}</Label>
            <Input
              id="passkey-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleRegister} disabled={isPending || !newName.trim()}>
              {isPending ? '...' : t('register')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-graphite-600">{t('registrationDisabled')}</p>
      )}
    </Card>
  )
}
