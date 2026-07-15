import { cn } from '../utils'

export interface BalanceBadgeProps {
  label: string
  className?: string
}

export function BalanceBadge({ label, className }: BalanceBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800',
        className
      )}
    >
      {label}
    </span>
  )
}
