'use client'

import { useLocale } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import { usePathname, useRouter } from '@/i18n/routing'

const localeNames: Record<Locale, string> = {
  fr: 'FR',
  en: 'EN',
}

export function LanguageSwitcher() {
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()

  const handleChange = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale })
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1">
      {Object.entries(localeNames).map(([loc, name]) => (
        <button
          key={loc}
          type="button"
          onClick={() => handleChange(loc as Locale)}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            locale === loc ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  )
}
