import type { MetadataRoute } from 'next'
import { connection } from 'next/server'

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/settings/', '/profile/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
