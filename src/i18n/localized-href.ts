export function localizedHref(locale: string, href: string) {
  if (href === '/') return `/${locale}`
  return `/${locale}${href.startsWith('/') ? href : `/${href}`}`
}
