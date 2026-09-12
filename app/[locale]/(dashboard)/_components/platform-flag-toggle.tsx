'use client'

import { useTranslations } from 'next-intl'
import { useId, useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'

type Props = {
  title: string
  description: string
  hint?: string
  enabled: boolean
  onSave: (enabled: boolean) => Promise<string>
}

/**
 * La case reflète l'état optimiste et revient en arrière si l'écriture est refusée : le
 * réglage gouverne toute l'instance, afficher un état non enregistré serait pire que
 * l'attente.
 */
export function PlatformFlagToggle({ title, description, hint, enabled, onSave }: Props) {
  const t = useTranslations('dashboard.platformFlag')
  const router = useRouter()
  const inputId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const hintId = useId()
  const [checked, setChecked] = useState(enabled)
  const [pending, startTransition] = useTransition()

  const onToggle = (next: boolean) => {
    setChecked(next)
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
        router.refresh()
      } catch {
        setChecked(!next)
        toast.error(t('error'))
      }
    })
  }

  return (
    <div className="flex items-start justify-between gap-6 px-6 py-5">
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
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-alabaster-700 ring-offset-2 transition-colors peer-checked:bg-emerald-600 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" />
        <span className="pointer-events-none absolute left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </label>
    </div>
  )
}
