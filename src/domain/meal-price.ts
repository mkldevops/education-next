/** Tarif journalier daté : il vaut à partir de `effectiveFrom` (`YYYY-MM-DD`), jusqu'au suivant. */
export type MealPriceEntry = { amount: number; effectiveFrom: string }

/** Tarif en vigueur le jour `day`, ou `null` avant le premier tarif. */
export function priceOn(prices: readonly MealPriceEntry[], day: string): number | null {
  let current: MealPriceEntry | null = null
  for (const price of prices) {
    if (price.effectiveFrom > day) continue
    if (current === null || price.effectiveFrom > current.effectiveFrom) current = price
  }
  return current?.amount ?? null
}

/**
 * Un tarif ne s'antidate pas : les encaissements passés ont figé le leur, et un dû déjà affiché
 * changerait sous les yeux de la famille. Seul le premier tarif d'un service peut remonter, pour
 * reprendre une année commencée hors de l'application.
 */
export function validateMealPriceDate(input: {
  effectiveFrom: string
  today: string
  hasPrice: boolean
}): 'OK' | 'backdated' {
  return input.hasPrice && input.effectiveFrom < input.today ? 'backdated' : 'OK'
}
