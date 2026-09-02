import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../utils'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded border border-dashed p-12 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-alabaster-800 p-3">
          <Icon size={24} className="text-graphite-700" />
        </div>
      )}
      <h3 className="text-sm font-medium text-graphite">{title}</h3>
      {description && <p className="mt-1 text-sm text-graphite-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
