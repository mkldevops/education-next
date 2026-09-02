import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../utils'

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      status: {
        PENDING: 'bg-amber-100 text-amber-800',
        ACTIVE: 'bg-emerald-100 text-emerald-800',
        COMPLETED: 'bg-blue-100 text-blue-800',
        CANCELLED: 'bg-red-100 text-red-800',
        red: 'bg-red-100 text-red-800',
        blue: 'bg-blue-100 text-blue-800',
        green: 'bg-emerald-100 text-emerald-800',
        amber: 'bg-amber-100 text-amber-800',
        gray: 'bg-alabaster-800 text-graphite',
      },
    },
    defaultVariants: {
      status: 'PENDING',
    },
  }
)

export interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ status }), className)}>{label ?? status}</span>
}

export { statusBadgeVariants }
