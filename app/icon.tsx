import { ImageResponse } from 'next/og'
import { getBrandingConfig } from '@/lib/branding'

export const dynamic = 'force-dynamic'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default async function Icon() {
  const { faviconUrl } = await getBrandingConfig()

  return new ImageResponse(
    faviconUrl ? (
      // biome-ignore lint/performance/noImgElement: ImageResponse requires native <img>
      <img src={faviconUrl} width={32} height={32} alt="favicon" />
    ) : (
      <div
        style={{
          background: '#3c6e71',
          width: 32,
          height: 32,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        A
      </div>
    ),
    size
  )
}
