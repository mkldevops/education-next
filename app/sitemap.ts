import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const staticPages = ['', '/a-propos', '/contact', '/privacy-policy', '/legal-notices']

  const publicPages = ['/login', '/register', '/forgot-password']

  const entries: MetadataRoute.Sitemap = []

  // Add static pages for each locale
  for (const locale of routing.locales) {
    for (const page of staticPages) {
      entries.push({
        url: `${baseUrl}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: page === '' ? 1 : 0.8,
      })
    }

    // Add public auth pages with lower priority
    for (const page of publicPages) {
      entries.push({
        url: `${baseUrl}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: 'yearly',
        priority: 0.3,
      })
    }
  }

  return entries
}
