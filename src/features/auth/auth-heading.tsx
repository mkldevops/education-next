import { cn } from '@peaklab/ui'
import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: ReactNode
  /** Pictogramme d'état (succès, lien expiré…), posé dans une pastille neutre. */
  icon?: ReactNode
  /** Petit libellé au-dessus du titre, par exemple « Invitation ». */
  eyebrow?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  className?: string
}

const ICON_TONES = {
  neutral: 'bg-surface text-foreground',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
} as const

/**
 * En-tête des écrans d'authentification : titre en Fraunces (surfaces publiques uniquement,
 * voir `docs/design/README.md`), description en Inter. Sans hook, utilisable côté serveur comme
 * dans les formulaires client qui changent d'état (succès, lien invalide).
 */
export function AuthHeading({
  title,
  description,
  icon,
  eyebrow,
  tone = 'neutral',
  className,
}: Props) {
  return (
    <div className={cn('space-y-3', className)}>
      {icon && (
        <div
          aria-hidden
          className={cn(
            'mb-6 flex size-12 items-center justify-center rounded-xl border border-border shadow-xs [&_svg]:size-5',
            ICON_TONES[tone]
          )}
        >
          {icon}
        </div>
      )}
      {eyebrow && (
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-[2rem] font-medium leading-[1.1] tracking-tight text-balance text-foreground sm:text-[2.25rem]">
        {title}
      </h1>
      {description && (
        <p className="text-[0.9375rem] leading-6 text-pretty text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}
