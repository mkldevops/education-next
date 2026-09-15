import { Button, buttonVariants } from '@peaklab/ui'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Home, LayoutDashboard, LogIn, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type ErrorTone = 'danger' | 'warning' | 'muted'

type ErrorActionIcon = 'dashboard' | 'home' | 'login'

type ErrorAction = {
  href: string
  icon?: ErrorActionIcon
  label: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
}

type ErrorPageShellProps = {
  actions?: ErrorAction[]
  description: string
  minHeight?: 'screen' | 'content'
  onRetry?: () => void
  retryLabel?: string
  statusCode: '401' | '403' | '404' | '500'
  title: string
}

const toneByStatus: Record<ErrorPageShellProps['statusCode'], ErrorTone> = {
  '401': 'warning',
  '403': 'warning',
  '404': 'muted',
  '500': 'danger',
}

const iconByAction: Record<ErrorActionIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  home: Home,
  login: LogIn,
}

const toneClasses: Record<ErrorTone, { accent: string; background: string; text: string }> = {
  danger: {
    accent: 'border-red-200 bg-red-50 text-red-700',
    background: 'from-red-50 via-white to-background',
    text: 'text-red-700',
  },
  muted: {
    accent: 'border-primary-light bg-primary-light text-primary-hover',
    background: 'from-primary-light/50 via-white to-background',
    text: 'text-primary',
  },
  warning: {
    accent: 'border-amber-200 bg-amber-50 text-amber-700',
    background: 'from-amber-50 via-white to-background',
    text: 'text-amber-700',
  },
}

const statusCells = Array.from({ length: 16 }, (_, index) => `status-cell-${index}`)

export function ErrorPageShell({
  actions = [],
  description,
  minHeight = 'screen',
  onRetry,
  retryLabel,
  statusCode,
  title,
}: ErrorPageShellProps) {
  const tone = toneClasses[toneByStatus[statusCode]]

  return (
    <section
      className={cn(
        'relative isolate flex items-center overflow-hidden bg-gradient-to-br px-4 py-16 sm:px-6 lg:px-8',
        tone.background,
        minHeight === 'screen' ? 'min-h-screen' : 'min-h-[calc(100vh-9rem)] rounded'
      )}
    >
      <div className="pointer-events-none absolute inset-0 error-page-grid opacity-60" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-graphite-900 to-transparent" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-4">
            <span
              className={cn(
                'flex size-14 items-center justify-center rounded border font-mono text-lg font-semibold shadow-sm',
                tone.accent
              )}
            >
              {statusCode}
            </span>
            <div className="h-px w-20 bg-graphite-900" />
          </div>

          <h1 className="mt-8 max-w-3xl text-4xl font-semibold leading-tight text-graphite-500 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-graphite-600">{description}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            {onRetry && retryLabel && (
              <Button type="button" onClick={onRetry}>
                <RefreshCw size={16} />
                {retryLabel}
              </Button>
            )}

            {actions.map((action) => {
              const Icon = action.icon ? iconByAction[action.icon] : ArrowLeft

              return (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  className={buttonVariants({ variant: action.variant ?? 'outline' })}
                >
                  <Icon size={16} />
                  {action.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="hidden shrink-0 md:block" aria-hidden="true">
          <div className="grid size-44 grid-cols-4 gap-2">
            {statusCells.map((cell, index) => (
              <div
                key={cell}
                className={cn(
                  'rounded border border-white/80 bg-white/70 shadow-sm',
                  index === 5 || index === 10 ? tone.text : 'text-alabaster-600'
                )}
              >
                <div className="flex h-full items-center justify-center font-mono text-xs font-semibold">
                  {index === 5 ? statusCode.slice(0, 1) : index === 10 ? statusCode.slice(1) : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
