'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@peaklab/ui'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/routing'
import { EVENT_CATEGORY_VALUES } from './event-enum-values'

// Le menu pousse une nouvelle URL plutôt que de filtrer un tableau local : la
// page relit `searchParams` côté serveur, ce qui garde toute la donnée affichée sous le
// contrôle de la requête Prisma plutôt que d'un état client.
export function EventsFilters() {
  const t = useTranslations('dashboard.pages.events.filters')
  const tCategory = useTranslations('eventCategory')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(name, value)
    } else {
      params.delete(name)
    }
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const categoryItems = [
    { value: null, label: t('all') },
    ...EVENT_CATEGORY_VALUES.map((category) => ({ value: category, label: tCategory(category) })),
  ]

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        items={categoryItems}
        value={searchParams.get('category') || null}
        onValueChange={(value) => updateParam('category', value ?? '')}
      >
        <SelectTrigger aria-label={t('category')} className="w-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {categoryItems.map((item) => (
            <SelectItem key={item.value ?? ''} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
