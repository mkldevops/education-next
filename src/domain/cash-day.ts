/** Ventilation d'une caisse : écolage, garderie, ou un service repas. */
export type CashLine = 'CANTEEN' | 'SNACK' | 'CHILDCARE' | 'TUITION'

export type CashTotals = {
  count: number
  total: number
  byMethod: Record<string, number>
  byLine: Record<CashLine, number>
}

type CashReceipt = {
  total: number
  method: string
  meals: ReadonlyArray<{ service: 'CANTEEN' | 'SNACK'; amount: number }>
  childcare: ReadonlyArray<{ amount: number }>
}

const round = (value: number) => Math.round(value * 100) / 100

/** Additionne des reçus, comptés en négatif quand `sign` vaut -1. */
function addReceipts(into: CashTotals, receipts: readonly CashReceipt[], sign: 1 | -1) {
  for (const receipt of receipts) {
    into.count += sign
    into.total = round(into.total + sign * receipt.total)
    into.byMethod[receipt.method] = round(
      (into.byMethod[receipt.method] ?? 0) + sign * receipt.total
    )
    let meals = 0
    for (const meal of receipt.meals) {
      meals += meal.amount
      into.byLine[meal.service] = round(into.byLine[meal.service] + sign * meal.amount)
    }
    let childcare = 0
    for (const line of receipt.childcare) {
      childcare += line.amount
      into.byLine.CHILDCARE = round(into.byLine.CHILDCARE + sign * line.amount)
    }
    // L'écolage n'a pas de ligne propre : c'est le reste du total.
    into.byLine.TUITION = round(into.byLine.TUITION + sign * (receipt.total - meals - childcare))
  }
  return into
}

const empty = (): CashTotals => ({
  count: 0,
  total: 0,
  byMethod: {},
  byLine: { CANTEEN: 0, SNACK: 0, CHILDCARE: 0, TUITION: 0 },
})

/**
 * Caisse d'un jour (écran « caisse du jour ») : les reçus émis ce jour-là, moins ceux annulés
 * ce jour-là, quel que soit leur jour d'émission. Une annulation tombe le jour où elle est
 * faite : le net d'un jour passé ne bouge plus, et il suit l'argent du tiroir.
 */
export function summarizeCashDay(input: {
  issued: readonly CashReceipt[]
  cancelled: readonly CashReceipt[]
}): { issued: CashTotals; cancelled: CashTotals; net: CashTotals } {
  return {
    issued: addReceipts(empty(), input.issued, 1),
    cancelled: addReceipts(empty(), input.cancelled, 1),
    net: addReceipts(addReceipts(empty(), input.issued, 1), input.cancelled, -1),
  }
}
