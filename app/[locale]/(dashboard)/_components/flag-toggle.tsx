'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useId, useState, useTransition } from 'react'
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
  /** Réglage dépendant, visuellement rattaché à son interrupteur principal. */
  nested?: boolean
  enabled: boolean
  onSave: (enabled: boolean) => Promise<string>
  /**
   * Fourni uniquement par Google, dont la coupure peut laisser des comptes sans aucune
   * méthode de connexion : décocher pendant que le drapeau est activé ouvre cette
   * confirmation au lieu d'écrire directement. Absent (passkey, MCP, bascule d'école),
   * le comportement reste le bascule à un clic d'origine, dans les deux sens.
   */
  confirmDisable?: ConfirmDisable
  /** Réglages dépendants, repliés tant que l'interrupteur est coupé. */
  children?: ReactNode
}

/**
 * La case reflète l'état optimiste et revient en arrière si l'écriture est refusée : le
 * réglage gouverne toute une instance ou toute une école, afficher un état non
 * enregistré serait pire que l'attente.
 */
export function FlagToggle({
  title,
  description,
  hint,
  nested = false,
  enabled,
  onSave,
  confirmDisable,
  children,
}: Props) {
  const t = useTranslations('dashboard.platformFlag')
  const router = useRouter()
  const inputId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const hintId = useId()
  const panelId = useId()
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
        // Réapplique `next` plutôt que de supposer la case déjà dans cet état : un
        // refus intercalé (relance) ou une confirmation abandonnée pendant que cette
        // écriture était en vol (dismiss) l'ont pu remettre à `!next` entre-temps. La
        // case ne doit jamais contredire le réglage qui vient d'être persisté.
        setChecked(next)
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
    <div>
      <div
        className={
          nested
            ? 'ml-6 flex items-start justify-between gap-6 border-l-2 border-alabaster-700 py-5 pl-4 pr-6'
            : 'flex items-start justify-between gap-6 px-6 py-5'
        }
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 id={titleId} className="text-sm font-semibold text-graphite">
              {title}
            </h3>
            <span
              id={`${inputId}-state`}
              className={
                checked
                  ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                  : 'rounded-full bg-alabaster-800 px-2 py-0.5 text-xs font-medium text-graphite-600'
              }
            >
              {checked ? t('enabled') : t('disabled')}
            </span>
          </div>
          <p id={descriptionId} className="mt-1 text-sm text-graphite-600">
            {description}
          </p>
          {hint && (
            <p id={hintId} className="mt-2 text-xs text-orange-600">
              {hint}
            </p>
          )}
        </div>
        <label
          htmlFor={inputId}
          className="relative inline-flex shrink-0 cursor-pointer items-center"
        >
          <input
            id={inputId}
            type="checkbox"
            checked={checked}
            disabled={pending}
            onChange={(event) => onToggle(event.target.checked)}
            aria-labelledby={`${titleId} ${inputId}-state`}
            aria-describedby={hint ? `${descriptionId} ${hintId}` : descriptionId}
            aria-controls={children ? panelId : undefined}
            aria-expanded={children ? checked : undefined}
            className="peer sr-only"
          />
          <span className="h-6 w-11 rounded-full bg-alabaster-700 ring-offset-2 transition-colors peer-checked:bg-emerald-600 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" />
          <span className="pointer-events-none absolute left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
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
      </div>
      {children && checked && (
        <div id={panelId} className="mb-5 ml-6 border-l-2 border-alabaster-700">
          {children}
        </div>
      )}
    </div>
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
