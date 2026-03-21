import { ImageResponse } from 'next/og'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default async function Icon() {
  const config = await db.config.findFirst({
    where: { name: 'logo_url', isActive: true },
    select: { value: true },
  })
  const logoUrl = config?.value || ''

  return new ImageResponse(
    logoUrl ? (
      // biome-ignore lint/performance/noImgElement: ImageResponse requires native <img>
      <img src={logoUrl} width={32} height={32} alt="logo" />
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
