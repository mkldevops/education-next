import { ImageResponse } from 'next/og'
import { getBrandingConfig, resolveBrandingSchoolId } from '@/lib/branding'
import { loadLogoDataUrl } from '@/lib/branding-icon'

export const dynamic = 'force-dynamic'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

/**
 * `ImageResponse` marque sa réponse `immutable` pendant un an en production, alors que l'URL
 * `/icon` ne change pas quand le logo change et sert toutes les écoles : sans cet en-tête, le
 * navigateur garde le premier favicon reçu, souvent celui par défaut.
 */
const headers = { 'cache-control': 'private, no-cache' }

/** Favicon généré depuis le logo de l'école, contenu sans déformation dans le carré. */
export default async function Icon() {
  const schoolId = await resolveBrandingSchoolId()
  const { logoUrl } = schoolId ? await getBrandingConfig(schoolId) : { logoUrl: undefined }
  const logo = logoUrl ? await loadLogoDataUrl(logoUrl) : null

  return new ImageResponse(
    logo ? (
      // biome-ignore lint/performance/noImgElement: ImageResponse requires native <img>
      <img src={logo} width={32} height={32} alt="favicon" style={{ objectFit: 'contain' }} />
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
    { ...size, headers }
  )
}
