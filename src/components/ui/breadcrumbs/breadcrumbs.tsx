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
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <Fragment key={item.href ?? item.label}>
              {index > 0 && (
                <li aria-hidden="true">
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                </li>
              )}
              <li>
                {isLast || !item.href ? (
                  <span className="font-medium text-gray-900">
                    {item.icon === 'home' && <Home className="inline h-4 w-4" />}
                    {!item.icon && item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="text-gray-500 transition-colors hover:text-gray-700"
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
