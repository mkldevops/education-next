export function roundHalfUp(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.floor(value * factor + 0.5) / factor
}

export function formatAmount(
  value: number | { toNumber?: () => number; toString: () => string }
): string {
  const num =
    typeof value === 'number' ? value : value.toNumber ? value.toNumber() : Number(value.toString())
  return roundHalfUp(num).toFixed(2)
}
