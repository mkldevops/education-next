import { z } from 'zod'

export const HOME_WIDGETS = [
  'collection',
  'tasks',
  'headcount',
  'collectionChart',
  'classFill',
  'schedule',
  'events',
] as const

export type HomeWidget = (typeof HOME_WIDGETS)[number]

export const hiddenWidgetsSchema = z.array(z.enum(HOME_WIDGETS)).max(HOME_WIDGETS.length)

/** Une clé retirée du code reste en base : on l'ignore à la lecture plutôt que d'échouer. */
export function readHiddenWidgets(stored: readonly string[]): Set<HomeWidget> {
  return new Set(HOME_WIDGETS.filter((widget) => stored.includes(widget)))
}
