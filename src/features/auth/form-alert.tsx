import { cn } from '@peaklab/ui'
import { CircleAlert, CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  tone?: 'danger' | 'success'
  className?: string
}

/**
 * Message de formulaire annoncé aux lecteurs d'écran : `alert` pour une erreur, qui interrompt,
 * `status` pour une confirmation, qui attend son tour.
 */
export function FormAlert({ children, tone = 'danger', className }: Props) {
  const Icon = tone === 'danger' ? CircleAlert : CircleCheck

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-5',
        tone === 'danger'
          ? 'border-danger/20 bg-danger-subtle text-danger'
          : 'border-success/20 bg-success-subtle text-success',
        className
      )}
    >
      <Icon aria-hidden className="mt-px size-4 shrink-0" />
      <p>{children}</p>
    </div>
  )
}
