'use client'

import { useTransition } from 'react'
import { useRouter } from '@/i18n/routing'

/** Affiche ou masque les colonnes sans appel enregistré ; l'état vit dans l'URL. */
export function AttendanceGapsSwitch({
  checked,
  href,
  label,
}: {
  checked: boolean
  href: string
  label: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-graphite print:hidden">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={isPending}
        onClick={() => startTransition(() => router.push(href, { scroll: false }))}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-alabaster-600'}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${checked ? 'right-0.5' : 'left-0.5'}`}
        />
      </button>
      {label}
    </label>
  )
}
