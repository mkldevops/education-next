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
            className="fixed z-50 -translate-y-1/2 rounded bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
            style={{ top: pos.top, left: pos.left }}
          >
            {label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
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
      className={cn(
        'flex items-center rounded transition-all duration-150',
        expanded ? 'gap-3 px-3 py-2' : 'size-11 justify-center',
        active
          ? 'bg-gradient-to-br from-primary to-primary/70 text-white shadow-lg shadow-primary/25'
          : 'text-graphite-800 hover:bg-alabaster-900 hover:text-graphite-600'
      )}
    >
      <Icon size={20} className="shrink-0" />
      {expanded && <span className="text-sm font-medium">{label}</span>}
    </Link>
  )

  if (!expanded) return <Tooltip label={label}>{link}</Tooltip>
  return link()
}
