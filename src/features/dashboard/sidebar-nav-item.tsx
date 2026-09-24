'use client'

import type { LucideIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'

function Tooltip({
  label,
  children,
}: {
  label: string
  children: (describedBy: string | undefined) => React.ReactNode
}) {
  const tooltipId = useId()
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const show = (e: React.MouseEvent | React.FocusEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 })
  }

  const hide = () => setPos(null)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: tooltip wrapper
    <div onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children(pos ? tooltipId : undefined)}
      {pos &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className="fixed z-50 -translate-y-1/2 rounded bg-graphite px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
            style={{ top: pos.top, left: pos.left }}
          >
            {label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-graphite" />
          </div>,
          document.body
        )}
    </div>
  )
}

export function NavItem({
  href,
  icon: Icon,
  label,
  active,
  expanded,
  onClick,
}: {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
  expanded: boolean
  onClick?: () => void
}) {
  const link = (describedBy?: string) => (
    <Link
      href={href}
      onClick={onClick}
      aria-label={expanded ? undefined : label}
      aria-describedby={describedBy}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center rounded-md transition-colors duration-(--duration-fast) ease-out',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        expanded ? 'gap-3 px-3 py-2' : 'size-11 justify-center',
        // Fond neutre et barre d'accent : la couleur d'école, arbitraire, ne porte que l'accent.
        active
          ? 'bg-surface-2 font-medium text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
          : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
      )}
    >
      <Icon size={20} className="shrink-0" />
      {expanded && <span className="text-sm font-medium">{label}</span>}
    </Link>
  )

  if (!expanded) return <Tooltip label={label}>{link}</Tooltip>
  return link()
}
