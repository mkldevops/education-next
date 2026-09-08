import type { ComponentPropsWithRef } from 'react'
import { cn } from '../utils'

export interface InputProps extends ComponentPropsWithRef<'input'> {}

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded border border-alabaster bg-white px-3 py-2 text-sm',
        'placeholder:text-graphite-700',
        'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export interface LabelProps extends ComponentPropsWithRef<'label'> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Label is associated via htmlFor by consumers
    <label
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  )
}

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded border border-alabaster bg-white px-3 py-2 text-sm',
        'placeholder:text-graphite-700',
        'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
