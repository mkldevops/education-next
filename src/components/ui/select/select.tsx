import type { SelectHTMLAttributes } from 'react'
import { cn } from '../utils'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'rounded border border-alabaster-700 bg-white px-3 py-2 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
