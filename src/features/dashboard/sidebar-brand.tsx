import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { toInitials } from './initials'

/**
 * Pastille d'identité d'école, façon espace de travail : logo configuré, sinon initiales sur un
 * aplat neutre. Jamais de dégradé — la couleur d'école, arbitraire, reste réservée à l'accent.
 */
export function SchoolMark({
  displayName,
  logoUrl,
  size = 'md',
}: {
  displayName: string
  logoUrl?: string
  size?: 'sm' | 'md'
}) {
  const box = size === 'sm' ? 'size-5 rounded text-[9px]' : 'size-7 rounded-md text-[11px]'

  if (logoUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
      <img
        src={logoUrl}
        alt=""
        aria-hidden
        className={cn(box, 'shrink-0 border border-border bg-surface object-contain')}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        box,
        'flex shrink-0 items-center justify-center bg-foreground font-semibold tracking-tight text-surface'
      )}
    >
      {toInitials(displayName)}
    </span>
  )
}

export function SidebarBrand({
  displayName,
  logoUrl,
  expanded,
}: {
  displayName: string
  logoUrl?: string
  expanded: boolean
}) {
  return (
    <Link
      href="/"
      aria-label={expanded ? undefined : displayName}
      className={cn(
        'flex items-center rounded-md transition-colors duration-(--duration-fast) hover:bg-surface-2',
        'focus-visible:outline-2 focus-visible:outline-ring',
        expanded ? 'h-10 w-full gap-2.5 px-2' : 'mx-auto size-10 justify-center'
      )}
    >
      <SchoolMark displayName={displayName} logoUrl={logoUrl} />
      {expanded && (
        <span className="flex-1 truncate text-sm font-semibold text-foreground">{displayName}</span>
      )}
    </Link>
  )
}
