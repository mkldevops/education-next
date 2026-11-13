import type { EventCategory } from '@/generated/prisma/enums'

/**
 * Teintes de la vue d'ensemble : l'or marque les jours sans classe (vacances, fermetures), la
 * rentrée prend la couleur de l'école, les autres catégories gardent une teinte fixe et
 * distincte. Les valeurs restent des littéraux pour que Tailwind les détecte.
 */
export const EVENT_CATEGORY_COLORS: Record<EventCategory, { cell: string; dot: string }> = {
  HOLIDAY: { cell: 'bg-[#c9a227] text-white', dot: 'bg-[#c9a227]' },
  CLOSURE: { cell: 'bg-[#8a6d12] text-white', dot: 'bg-[#8a6d12]' },
  TERM_START: { cell: 'bg-primary text-primary-foreground', dot: 'bg-primary' },
  MEETING: { cell: 'bg-[#2f6fb3] text-white', dot: 'bg-[#2f6fb3]' },
  OUTING: { cell: 'bg-[#2e8b57] text-white', dot: 'bg-[#2e8b57]' },
  CELEBRATION: { cell: 'bg-[#c2417a] text-white', dot: 'bg-[#c2417a]' },
  OTHER: { cell: 'bg-graphite-600 text-white', dot: 'bg-graphite-600' },
}
