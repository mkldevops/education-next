import type { SchoolRole } from '@/types/enums'

/**
 * Nouveauté de la plateforme, publiée une fois dans le Directus central et lue par toutes les
 * instances. Le texte est déjà résolu dans la langue de l'utilisateur.
 */
export type Announcement = {
  id: string
  publishedAt: Date
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

export function countUnreadAnnouncements(
  announcements: Announcement[],
  reader: AnnouncementReader
) {
  return visibleAnnouncements(announcements, reader).filter((a) => isAnnouncementUnread(a, reader))
    .length
}

/** La plus récente annonce mise en avant et pas encore vue, sinon rien. */
export function resolvePopupAnnouncement(
  announcements: Announcement[],
  reader: AnnouncementReader
): Announcement | null {
  return (
    visibleAnnouncements(announcements, reader).find(
      (announcement) => announcement.highlight && isAnnouncementUnread(announcement, reader)
    ) ?? null
  )
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
