import { cn } from '../utils'

export interface CircleProgressProps {
  /** Pourcentage, borné à 0–100 par le composant. */
  value: number
  /** Diamètre en pixels. */
  size?: number
  /** Texte au centre ; le pourcentage arrondi par défaut. */
  label?: string
  /** Tonalité de l'arc : `primary` par défaut, `amber`/`red` pour une alerte. */
  tone?: 'primary' | 'amber' | 'red' | 'green'
  className?: string
}

const STROKE = 4

const toneClass: Record<NonNullable<CircleProgressProps['tone']>, string> = {
  primary: 'stroke-primary',
  amber: 'stroke-amber-500',
  red: 'stroke-red-500',
  green: 'stroke-green-500',
}

/**
 * Jauge circulaire en SVG, rendue côté serveur.
 *
 * L'arc part de midi (rotation de -90°) et le texte central porte la valeur : la couleur seule
 * ne transmet jamais l'information.
 */
export function CircleProgress({
  value,
  size = 40,
  label,
  tone = 'primary',
  className,
}: CircleProgressProps) {
  const clamped = Math.min(Math.max(value, 0), 100)
  const radius = (size - STROKE) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <span
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-alabaster-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={toneClass[tone]}
        />
      </svg>
      <span className="absolute text-[10px] font-medium tabular-nums text-graphite">
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </span>
  )
}
