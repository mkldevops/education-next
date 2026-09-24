import type { ComponentPropsWithRef } from 'react'
import { cn } from '../utils'

export interface SelectProps extends ComponentPropsWithRef<'select'> {}

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded border border-input bg-white px-3 py-2 text-sm',
        'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
