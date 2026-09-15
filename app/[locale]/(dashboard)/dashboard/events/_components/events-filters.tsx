'use client'

import { Select } from '@peaklab/ui'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/routing'
import { EVENT_CATEGORY_VALUES } from './event-enum-values'

type Props = {
  years: number[]
}

// Les deux menus poussent une nouvelle URL plutôt que de filtrer un tableau local : la
// page relit `searchParams` côté serveur, ce qui garde toute la donnée affichée sous le
// contrôle de la requête Prisma plutôt que d'un état client.
export function EventsFilters({ years }: Props) {
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

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        value={searchParams.get('year') ?? ''}
        onChange={(e) => updateParam('year', e.target.value)}
        aria-label={t('year')}
        className="w-auto"
      >
        <option value="">{t('all')}</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>
      <Select
        value={searchParams.get('category') ?? ''}
        onChange={(e) => updateParam('category', e.target.value)}
        aria-label={t('category')}
        className="w-auto"
      >
        <option value="">{t('all')}</option>
        {EVENT_CATEGORY_VALUES.map((category) => (
          <option key={category} value={category}>
            {tCategory(category)}
          </option>
        ))}
      </Select>
    </div>
  )
}
