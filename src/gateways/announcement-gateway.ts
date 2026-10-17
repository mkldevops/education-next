import { z } from 'zod'
import type { Announcement } from '@/domain/announcement'
import { SchoolRole } from '@/types/enums'

/**
 * Lecture des nouveautés depuis le Directus central (`DIRECTUS_URL`), commun à toutes les
 * instances. Le token n'a qu'un droit de lecture, filtré côté Directus sur `status = published`
 * et `published_at <= $NOW` : un brouillon ou une publication programmée n'arrive jamais ici.
 */

const ANNOUNCEMENTS_CACHE_TAG = 'announcements'

const REVALIDATE_SECONDS = 600
const TIMEOUT_MS = 3000
const FIELDS = [
  'id',
  'published_at',
  'highlight',
  'audience',
  'link',
  'image',
  'translations.languages_code',
  'translations.title',
  'translations.summary',
  'translations.body',
  'translations.video',
].join(',')

const translationSchema = z.object({
  languages_code: z.string(),
  title: z.string(),
  summary: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  video: z.string().nullable().optional(),
})

const itemSchema = z.object({
  id: z.string(),
  published_at: z.string().nullable(),
  highlight: z.boolean().nullable().optional(),
  audience: z.array(z.string()).nullable().optional(),
  link: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  translations: z.array(translationSchema),
})

const responseSchema = z.object({ data: z.array(z.unknown()) })

type DirectusItem = z.infer<typeof itemSchema>

const ROLES = new Set<string>(Object.values(SchoolRole))

function getDirectusConfig() {
  const url = process.env.DIRECTUS_URL
  const token = process.env.DIRECTUS_TOKEN
  if (!url || !token) return null
  return { url: url.replace(/\/+$/, ''), token }
}

/** Langue demandée, puis français, puis la première disponible. */
function pickTranslation(item: DirectusItem, locale: string) {
  return (
    item.translations.find((t) => t.languages_code === locale) ??
    item.translations.find((t) => t.languages_code === 'fr') ??
    item.translations[0] ??
    null
  )
}

function assetUrl(baseUrl: string, fileId: string | null | undefined) {
  return fileId ? `${baseUrl}/assets/${encodeURIComponent(fileId)}` : null
}

function toAnnouncement(item: DirectusItem, locale: string, baseUrl: string): Announcement | null {
  const translation = pickTranslation(item, locale)
  if (!translation || !item.published_at) return null
  const publishedAt = new Date(item.published_at)
  if (Number.isNaN(publishedAt.getTime())) return null

  return {
    id: item.id,
    publishedAt,
    highlight: item.highlight ?? false,
    audience: (item.audience ?? []).filter((role): role is SchoolRole => ROLES.has(role)),
    link: item.link ?? null,
    imageUrl: assetUrl(baseUrl, item.image),
    videoUrl: assetUrl(baseUrl, translation.video),
    title: translation.title,
    summary: translation.summary ?? null,
    body: translation.body ?? null,
  }
}

/**
 * Jamais d'exception : sans configuration, Directus injoignable ou réponse inattendue, la liste
 * est vide et le tableau de bord s'affiche comme s'il n'y avait aucune nouveauté.
 */
export async function listAnnouncements(locale: string): Promise<Announcement[]> {
  const config = getDirectusConfig()
  if (!config) return []

  try {
    const response = await fetch(
      `${config.url}/items/announcements?fields=${FIELDS}&sort=-published_at&limit=50`,
      {
        headers: { Authorization: `Bearer ${config.token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: REVALIDATE_SECONDS, tags: [ANNOUNCEMENTS_CACHE_TAG] },
      }
    )
    if (!response.ok) return []

    const parsed = responseSchema.safeParse(await response.json())
    if (!parsed.success) return []

    return parsed.data.data.flatMap((raw) => {
      const item = itemSchema.safeParse(raw)
      if (!item.success) return []
      const announcement = toAnnouncement(item.data, locale, config.url)
      return announcement ? [announcement] : []
    })
  } catch {
    return []
  }
}
