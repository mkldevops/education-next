import { createNavigation } from 'next-intl/navigation'
import { defineRouting } from 'next-intl/routing'
import { defaultLocale, locales } from './locales'

export const routing = defineRouting({
  locales,
  defaultLocale,
})

export type { Locale } from './locales'

export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
