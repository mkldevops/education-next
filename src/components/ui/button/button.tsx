import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '../utils'

const buttonVariants = cva(
  // L'anneau est un contour décalé sur le fond : il reste visible sur un bouton primaire, là où
  // l'ancien `ring` héritait du texte blanc et se fondait dans son offset blanc.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'bg-alabaster-800 text-graphite hover:bg-alabaster-700',
        outline: 'border border-input bg-transparent hover:bg-surface-2 hover:text-foreground',
        ghost: 'hover:bg-surface-2 hover:text-foreground',
        link: 'text-foreground underline-offset-4 hover:underline',
        destructive: 'bg-danger text-white hover:bg-danger/90',
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
