import type { MetadataRoute } from 'next'
import { getBrandingConfig, resolveBrandingSchoolId } from '@/lib/branding'

export const dynamic = 'force-dynamic'

function getIconType(src: string) {
  const path = src.split('?')[0]?.toLowerCase() || ''

  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.ico')) return 'image/x-icon'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.png')) return 'image/png'

  return undefined
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const schoolId = await resolveBrandingSchoolId()
  const { faviconUrl } = schoolId ? await getBrandingConfig(schoolId) : { faviconUrl: undefined }
  const faviconType = faviconUrl ? getIconType(faviconUrl) : undefined
  const configuredFavicon: NonNullable<MetadataRoute.Manifest['icons']> = faviconUrl
    ? [
        {
          src: faviconUrl,
          sizes: 'any',
          purpose: 'any' as const,
          ...(faviconType ? { type: faviconType } : {}),
        },
      ]
    : []
  const icons: NonNullable<MetadataRoute.Manifest['icons']> = [
    ...configuredFavicon,
    {
      src: '/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-192x192-maskable.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/icon-512x512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ]

  return {
    name: 'Education App',
    short_name: 'Education',
    description: 'Application de gestion scolaire',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#3c6e71',
    icons,
    screenshots: [
      {
        src: '/screenshot-540x720.png',
        sizes: '540x720',
        type: 'image/png',
        form_factor: 'narrow',
      },
      {
        src: '/screenshot-1280x720.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
      },
    ],
    categories: ['education', 'productivity'],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'Go to dashboard',
        url: '/dashboard',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  }
}
