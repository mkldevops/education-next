import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function KpiCard({
  href,
  label,
  value,
  hint,
  icon: Icon,
}: {
  href: string
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: LucideIcon
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-5',
        'transition-[border-color,box-shadow] duration-(--duration-fast) hover:border-input/70 hover:shadow-sm',
        focusRing
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon
          size={16}
          aria-hidden="true"
          className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        />
      </div>
      <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Link>
  )
}

const TONES = {
  info: 'bg-info-subtle text-info',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  neutral: 'bg-surface-2 text-muted-foreground',
} as const

export function TaskRow({
  href,
  title,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  href: string
  title: string
  hint?: string
  icon: LucideIcon
  tone?: keyof typeof TONES
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-(--duration-fast) hover:bg-surface-2',
          focusRing
        )}
      >
        <span
          className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', TONES[tone])}
        >
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{title}</span>
          {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
        </span>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  )
}

export function Panel({
  id,
  title,
  action,
  className,
  children,
}: {
  id: string
  title: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex flex-col rounded-lg border border-border bg-surface shadow-xs',
        className
      )}
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 id={id} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {action}
      </div>
      <div className="flex-1 p-2 sm:p-3">{children}</div>
    </section>
  )
}

export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'shrink-0 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
        focusRing
      )}
    >
      {children}
    </Link>
  )
}
