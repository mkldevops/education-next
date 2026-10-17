import { cn } from '@/lib/utils'

/**
 * Visuel d'une nouveauté : la vidéo prend le pas sur l'image, qui lui sert d'affiche. Muette et en
 * boucle comme une animation, elle garde ses contrôles pour pouvoir être mise en pause.
 */
export function AnnouncementMedia({
  imageUrl,
  videoUrl,
  className,
}: {
  imageUrl: string | null
  videoUrl: string | null
  className?: string
}) {
  const classes = cn('aspect-video w-full bg-alabaster-900 object-cover', className)

  if (videoUrl) {
    return (
      <video
        src={videoUrl}
        poster={imageUrl ?? undefined}
        className={classes}
        autoPlay
        muted
        loop
        playsInline
        controls
      />
    )
  }

  if (!imageUrl) return null

  return (
    // biome-ignore lint/performance/noImgElement: image servie par le Directus central, hors remotePatterns
    <img src={imageUrl} alt="" loading="lazy" className={classes} />
  )
}
