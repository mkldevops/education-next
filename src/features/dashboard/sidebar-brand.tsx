import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { toInitials } from './initials'

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
    <div
      className={cn(
        'flex shrink-0 items-center py-4',
        expanded ? 'h-16 border-b border-alabaster-700 px-6' : 'justify-center'
      )}
    >
      {expanded ? (
        <Link href="/" className="flex items-center gap-2">
          {logoUrl ? (
            // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
            <img src={logoUrl} alt={displayName} className="h-8 w-auto object-contain" />
          ) : (
            <span className="text-xl font-bold text-primary">{displayName}</span>
          )}
        </Link>
      ) : (
        <Link
          href="/"
          className="flex size-10 items-center justify-center rounded bg-gradient-to-br from-primary to-primary/70 text-[15px] font-extrabold text-white"
        >
          {logoUrl ? (
            // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
            <img src={logoUrl} alt={displayName} className="size-8 rounded object-contain" />
          ) : (
            toInitials(displayName)
          )}
        </Link>
      )}
    </div>
  )
}
