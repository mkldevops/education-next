import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { routing } from '@/i18n/routing'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const publicPages = ['/login', '/forgot-password']

  const entries: MetadataRoute.Sitemap = []

  for (const locale of routing.locales) {
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
