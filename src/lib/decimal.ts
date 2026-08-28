export type DecimalLike = number | { toNumber?: () => number; toString: () => string }

export function toNumber(value: DecimalLike): number {
  if (typeof value === 'number') return value
  return value.toNumber ? value.toNumber() : Number(value.toString())
}

export function roundHalfUp(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.floor(value * factor + 0.5) / factor
}

export function formatAmount(value: DecimalLike): string {
  return roundHalfUp(toNumber(value)).toFixed(2)
}

export function formatCurrency(value: DecimalLike, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(
    roundHalfUp(toNumber(value))
  )
}
