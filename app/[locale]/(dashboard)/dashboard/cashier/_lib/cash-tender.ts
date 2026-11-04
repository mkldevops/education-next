const UNITS = [1, 5, 10, 20, 50, 100, 500, 1000, 5000, 10000]

/**
 * Montants ronds qu'une famille tend le plus souvent pour régler `total` en espèces :
 * le total arrondi au-dessus sur chaque coupure, au-delà du total, trois au plus.
 */
export function suggestTenders(total: number, count = 3): number[] {
  if (!(total > 0)) return []
  const suggestions = new Set<number>()
  for (const unit of UNITS) {
    const rounded = Math.ceil(total / unit) * unit
    if (rounded > total) suggestions.add(rounded)
  }
  return [...suggestions].sort((a, b) => a - b).slice(0, count)
}
