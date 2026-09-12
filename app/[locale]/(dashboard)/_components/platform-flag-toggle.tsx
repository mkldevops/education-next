'use client'

import {
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'

type ConfirmDisable = {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
}

type Props = {
  title: string
  description: string
  hint?: string
  enabled: boolean
  onSave: (enabled: boolean) => Promise<string>
  /**
   * Fourni uniquement par Google, dont la coupure peut laisser des comptes sans aucune
   * méthode de connexion : décocher pendant que le drapeau est activé ouvre cette
   * confirmation au lieu d'écrire directement. Absent (passkey, MCP, bascule d'école),
   * le comportement reste le bascule à un clic d'origine, dans les deux sens.
   */
  confirmDisable?: ConfirmDisable
}

/**
 * La case reflète l'état optimiste et revient en arrière si l'écriture est refusée : le
 * réglage gouverne toute l'instance, afficher un état non enregistré serait pire que
 * l'attente.
 */
export function PlatformFlagToggle({
  title,
  description,
  hint,
  enabled,
  onSave,
  confirmDisable,
}: Props) {
  const t = useTranslations('dashboard.platformFlag')
  const router = useRouter()
  const inputId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const hintId = useId()
  const [checked, setChecked] = useState(enabled)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const commit = (next: boolean, onSaved?: () => void) => {
    startTransition(async () => {
      // Le refus typé et le rejet réseau doivent tous deux revenir en arrière : afficher
      // une case cochée pour une écriture qui n'a pas eu lieu ment sur l'état de l'instance.
      try {
        const result = await onSave(next)
        if (result !== 'OK') {
          setChecked(!next)
          toast.error(t('error'))
          return
        }
        onSaved?.()
        router.refresh()
      } catch {
        setChecked(!next)
        toast.error(t('error'))
      }
    })
  }

  const onToggle = (next: boolean) => {
    setChecked(next)
    // Décocher pendant que le drapeau est activé est la seule transition possible vers
    // `false` : la confirmation ne s'ouvre donc jamais à l'activation.
    if (!next && confirmDisable) {
      setConfirming(true)
      return
    }
    commit(next)
  }

  const cancelDisable = () => {
    setConfirming(false)
    setChecked(true)
  }

  // Ferme la confirmation seulement après l'écriture réussie : un refus ou un rejet la
  // laisse ouverte, avec le toast d'erreur, plutôt que de forcer un nouveau clic sur la case.
  const confirmDisableNow = () => commit(false, () => setConfirming(false))

  return (
    <Card className="rounded border border-alabaster-700 p-6">
      <h2 id={titleId} className="text-lg font-semibold text-graphite">
        {title}
      </h2>
      <p id={descriptionId} className="mt-1 text-sm text-graphite-600">
        {description}
      </p>
      {hint && (
        <p id={hintId} className="mt-2 text-sm text-orange-600">
          {hint}
        </p>
      )}
      <label htmlFor={inputId} className="mt-4 flex items-center gap-2 text-sm text-graphite">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(event) => onToggle(event.target.checked)}
          aria-labelledby={`${titleId} ${inputId}-state`}
          aria-describedby={hint ? `${descriptionId} ${hintId}` : descriptionId}
          className="h-4 w-4 rounded border-alabaster"
        />
        <span id={`${inputId}-state`}>{checked ? t('enabled') : t('disabled')}</span>
      </label>
      {confirming && confirmDisable && (
        <Dialog initialOpen>
          <DisableConfirmation
            confirmDisable={confirmDisable}
            pending={pending}
            onConfirm={confirmDisableNow}
            onDismiss={cancelDisable}
          />
        </Dialog>
      )}
    </Card>
  )
}

type DisableConfirmationProps = {
  confirmDisable: ConfirmDisable
  pending: boolean
  onConfirm: () => void
  onDismiss: () => void
}

/**
 * `DialogContent` ferme aussi sur Échap et sur un clic hors panneau, en appelant son
 * `setOpen` interne — jamais un gestionnaire du parent. Sans cet effet, ces deux voies
 * masquent le panneau sans jamais rétablir la case ni réarmer la confirmation, qui ne
 * se rouvrirait plus : couper Google deviendrait silencieusement impossible.
 * `useDialog()` n'existe qu'à l'intérieur de `Dialog`, d'où ce composant séparé.
 */
function DisableConfirmation({
  confirmDisable,
  pending,
  onConfirm,
  onDismiss,
}: DisableConfirmationProps) {
  const { open, setOpen } = useDialog()

  useEffect(() => {
    if (!open) onDismiss()
  }, [open, onDismiss])

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{confirmDisable.title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="text-sm text-graphite-600">{confirmDisable.description}</p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
          {confirmDisable.cancelLabel}
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
          {pending ? '...' : confirmDisable.confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
