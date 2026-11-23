/**
 * Partage `amount` en `count` parts égales au pas de la devise. Les unités restantes vont
 * une à une aux premières parts : la somme des parts vaut toujours le montant saisi.
 */
export function splitAmount(amount: number, count: number, fractionDigits: number): number[] {
  if (!(amount > 0) || count < 1) return []
  const scale = 10 ** fractionDigits
  const units = Math.round(amount * scale)
  const base = Math.floor(units / count)
  const extra = units - base * count
  return Array.from({ length: count }, (_, index) => (base + (index < extra ? 1 : 0)) / scale)
}
