export const DAY_MS = 24 * 60 * 60 * 1000

/** Minuit UTC du quantième UTC de `date`. */
export function utcStartOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}
