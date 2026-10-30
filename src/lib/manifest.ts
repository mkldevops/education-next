import type { MetadataRoute } from 'next'
import { getBrandingAssets } from '@/lib/branding-assets'
import { getPwaBranding } from '@/lib/pwa-branding'

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
  const { logoUrl, schoolName, themeColor, backgroundColor } = await getPwaBranding()
  const logoType = logoUrl ? getIconType(logoUrl) : undefined
  const schoolLogo: NonNullable<MetadataRoute.Manifest['icons']> = logoUrl
    ? [
        {
          src: logoUrl,
          sizes: 'any',
          purpose: 'any' as const,
          ...(logoType ? { type: logoType } : {}),
        },
      ]
    : []
  const assets = getBrandingAssets(logoUrl)
  const icons: NonNullable<MetadataRoute.Manifest['icons']> = assets
    ? assets
        .filter((asset) => asset.purpose !== 'apple')
        .map((asset) => ({
          src: asset.src,
          sizes: `${asset.size}x${asset.size}`,
          type: 'image/png',
          purpose: asset.purpose,
        }))
    : [
        ...schoolLogo,
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
    id: '/dashboard',
    name: schoolName || 'Education App',
    short_name: schoolName || 'Education',
    description: 'Application de gestion scolaire',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: backgroundColor,
    theme_color: themeColor,
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
        icons: icons.filter((icon) => icon.sizes === '192x192' && icon.purpose === 'any'),
      },
    ],
  }
}
