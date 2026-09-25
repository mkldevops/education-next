import sharp from 'sharp'
import { AI_ASSISTANT_LIMITS, isAiAssistantImageType } from '@/domain/ai-assistant'

type SanitizeImageResult =
  | { status: 'OK'; dataUrl: string; width: number; height: number }
  | { status: 'forbiddenFile' | 'unreadableImage' | 'imageTooLarge' }

export type ImageSanitizer = (bytes: Uint8Array) => Promise<SanitizeImageResult>

const FORMAT_TO_TYPE: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

/**
 * Réencode une photo de fiche avant qu'elle ne parte chez le fournisseur.
 *
 * Le type annoncé par le navigateur n'est pas cru : c'est l'en-tête du fichier, lu par
 * sharp, qui décide. Un GIF, un SVG, un PDF renommé rendent `forbiddenFile` — le SVG en
 * particulier n'est pas rastérisé ici, contrairement au logo d'école, car une fiche
 * d'inscription n'est jamais un vecteur. Les dimensions déclarées sont bornées **avant**
 * le décodage pour qu'une image piégée ne réserve pas des gigaoctets.
 *
 * `.rotate()` applique l'orientation EXIF, puis le WebP de sortie ne porte plus aucune
 * métadonnée : ni géolocalisation, ni date, ni modèle de téléphone. Tout se passe en
 * mémoire ; rien n'est écrit sur disque ni dans le stockage de médias.
 */
export const sanitizeImage: ImageSanitizer = async (bytes) => {
  let format: string | undefined
  let width: number | undefined
  let height: number | undefined
  try {
    const metadata = await sharp(bytes).metadata()
    format = metadata.format
    width = metadata.width
    height = metadata.height
  } catch {
    return { status: 'unreadableImage' }
  }

  const detectedType = format ? FORMAT_TO_TYPE[format] : undefined
  if (!detectedType || !isAiAssistantImageType(detectedType)) return { status: 'forbiddenFile' }
  if (!width || !height) return { status: 'unreadableImage' }
  if (width * height > AI_ASSISTANT_LIMITS.maxImagePixels) return { status: 'imageTooLarge' }

  try {
    const { data, info } = await sharp(bytes, {
      limitInputPixels: AI_ASSISTANT_LIMITS.maxImagePixels,
    })
      .rotate()
      .resize({
        width: AI_ASSISTANT_LIMITS.maxImageDimension,
        height: AI_ASSISTANT_LIMITS.maxImageDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true })

    return {
      status: 'OK',
      dataUrl: `data:image/webp;base64,${data.toString('base64')}`,
      width: info.width,
      height: info.height,
    }
  } catch {
    return { status: 'unreadableImage' }
  }
}
