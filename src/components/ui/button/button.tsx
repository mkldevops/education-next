import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '../utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]',
        secondary: 'bg-alabaster-800 text-graphite hover:bg-alabaster-700',
        outline:
          'border border-alabaster bg-transparent hover:bg-primary-light hover:text-primary-hover',
        ghost: 'hover:bg-primary-light hover:text-primary-hover',
        link: 'text-[var(--color-primary)] underline-offset-4 hover:underline',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
      },
      size: {
        default: 'h-10 px-4 py-2 text-sm',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends ComponentPropsWithRef<'button'>,
    VariantProps<typeof buttonVariants> {
  children: ReactNode
}

export function Button({
  className,
  variant,
  size,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size, className }))} {...props}>
      {children}
    </button>
  )
}

export { buttonVariants }
