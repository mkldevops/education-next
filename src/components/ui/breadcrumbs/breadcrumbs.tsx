import { ChevronRight, Home } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from '@/i18n/routing'

export type BreadcrumbItem = {
  label: string
  href?: string
  icon?: 'home'
}

type BreadcrumbsProps = {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className = 'mb-4' }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <Fragment key={item.href ?? item.label}>
              {index > 0 && (
                <li aria-hidden="true">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                </li>
              )}
              <li className="min-w-0">
                {isLast || !item.href ? (
                  <span
                    className="block max-w-[12rem] truncate font-medium text-foreground"
                    title={item.icon ? undefined : item.label}
                  >
                    {item.icon === 'home' && <Home className="inline h-4 w-4" />}
                    {!item.icon && item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="block max-w-[12rem] truncate rounded-sm text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    title={item.icon ? undefined : item.label}
                  >
                    {item.icon === 'home' ? <Home className="inline h-4 w-4" /> : item.label}
                  </Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
