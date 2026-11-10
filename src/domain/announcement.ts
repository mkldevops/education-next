import type { SchoolRole } from '@/types/enums'

/**
 * Nouveauté de la plateforme, publiée une fois dans le Directus central et lue par toutes les
 * instances. Le texte est déjà résolu dans la langue de l'utilisateur.
 */
export type Announcement = {
  id: string
  publishedAt: Date
  /** Fin de mise en avant choisie dans le CMS ; à défaut, `publishedAt` + 15 jours. */
  expiresAt: Date | null
  highlight: boolean
  audience: SchoolRole[]
  link: string | null
  imageUrl: string | null
  /** Vidéo propre à la langue, prioritaire sur l'image qui lui sert alors d'affiche. */
  videoUrl: string | null
  title: string
  summary: string | null
  body: string | null
}

export type AnnouncementReader = {
  roles: readonly SchoolRole[]
  isSuperAdmin: boolean
  /** `User.announcementsSeenAt`, ou `createdAt` à défaut : un compte neuf ne doit pas hériter d'un arriéré. */
  seenAt: Date
}

/**
 * Un super-admin voit tout, quel que soit son rôle d'école : il doit pouvoir relire ce que chaque
 * public reçoit. Une audience vide ne vise personne. Un membre à plusieurs rôles lit ce qui vise
 * l'un d'eux.
 */
export function isAnnouncementVisible(announcement: Announcement, reader: AnnouncementReader) {
  if (reader.isSuperAdmin) return true
  return reader.roles.some((role) => announcement.audience.includes(role))
}

export function visibleAnnouncements(announcements: Announcement[], reader: AnnouncementReader) {
  return announcements
    .filter((announcement) => isAnnouncementVisible(announcement, reader))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}

export function isAnnouncementUnread(announcement: Announcement, reader: AnnouncementReader) {
  return announcement.publishedAt.getTime() > reader.seenAt.getTime()
}

export const ANNOUNCEMENT_DEFAULT_LIFETIME_DAYS = 15

const DAY_MS = 24 * 60 * 60 * 1000

export function announcementExpiresAt(announcement: Announcement) {
  return (
    announcement.expiresAt ??
    new Date(announcement.publishedAt.getTime() + ANNOUNCEMENT_DEFAULT_LIFETIME_DAYS * DAY_MS)
  )
}

/**
 * Une nouveauté expirée reste dans l'historique de `/dashboard/news`, mais ne compte plus comme
 * non lue et ne déclenche plus la pop-up.
 */
export function isAnnouncementActive(announcement: Announcement, now: Date = new Date()) {
  return announcementExpiresAt(announcement).getTime() > now.getTime()
}

export function countUnreadAnnouncements(
  announcements: Announcement[],
  reader: AnnouncementReader,
  now: Date = new Date()
) {
  return visibleAnnouncements(announcements, reader).filter(
    (a) => isAnnouncementActive(a, now) && isAnnouncementUnread(a, reader)
  ).length
}

export const MAX_POPUP_ANNOUNCEMENTS = 5

/** Annonces mises en avant, actives et pas encore vues, de la plus récente à la plus ancienne. */
export function resolvePopupAnnouncements(
  announcements: Announcement[],
  reader: AnnouncementReader,
  { now = new Date(), limit = MAX_POPUP_ANNOUNCEMENTS }: { now?: Date; limit?: number } = {}
): Announcement[] {
  return visibleAnnouncements(announcements, reader)
    .filter(
      (announcement) =>
        announcement.highlight &&
        isAnnouncementActive(announcement, now) &&
        isAnnouncementUnread(announcement, reader)
    )
    .slice(0, limit)
}

/**
 * Le lien vient d'un CMS : seul un chemin interne au tableau de bord est suivi, jamais une URL
 * absolue ni un `//hôte` qui sortirait de l'application.
 */
export function safeAnnouncementLink(link: string | null): string | null {
  if (!link) return null
  const trimmed = link.trim()
  if (!trimmed.startsWith('/dashboard')) return null
  if (trimmed.startsWith('//') || trimmed.includes('\\')) return null
  return trimmed
}
