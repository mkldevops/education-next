import sharp from 'sharp'

type WebpOptions = {
  /** Plus grand côté conservé ; une image plus petite n'est jamais agrandie. */
  maxDimension: number
  quality: number
}

type OptimizeImageResult = { result: 'OK'; bytes: Uint8Array } | { result: 'invalidImage' }

type ImageOptimizer = (bytes: Uint8Array, options: WebpOptions) => Promise<OptimizeImageResult>

/**
 * Réencode toute image téléversée en WebP. L'orientation EXIF est appliquée avant d'être
 * retirée avec les autres métadonnées : une photo de téléphone garde son sens sans emporter
 * sa géolocalisation. Un SVG est rastérisé, ce qui supprime aussi le contenu actif qu'il
 * pouvait porter. Un fichier que sharp ne sait pas décoder rend `invalidImage`.
 */
export const optimizeImageToWebp: ImageOptimizer = async (bytes, { maxDimension, quality }) => {
  try {
    const output = await sharp(bytes, { density: 300 })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer()
    return { result: 'OK', bytes: new Uint8Array(output) }
  } catch {
    return { result: 'invalidImage' }
  }
}
