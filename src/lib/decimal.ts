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

/** Devise des écoles sans réglage explicite : la colonne `School.currency` porte le même défaut. */
export const DEFAULT_CURRENCY = 'EUR'

/** Décimales de la devise selon ISO 4217 : 2 pour l'euro, 0 pour le franc comorien. */
export function currencyFractionDigits(currency: string): number {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  )
}

export function formatCurrency(value: DecimalLike, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    roundHalfUp(toNumber(value), currencyFractionDigits(currency))
  )
}

/** Symbole affiché dans les libellés de saisie (« Montant (€) », « Montant (KMF) »). */
export function currencySymbol(locale: string, currency: string): string {
  return (
    new Intl.NumberFormat(locale, { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  )
}

/** Un montant saisi n'a pas plus de décimales que sa devise : 1 500,50 KMF n'existe pas. */
export function fitsCurrencyPrecision(amount: number, currency: string): boolean {
  const factor = 10 ** currencyFractionDigits(currency)
  return Math.abs(amount * factor - Math.round(amount * factor)) < 1e-6
}

/** Pas des champs de montant : 0,01 en euros, 1 en francs comoriens. */
export function currencyStep(currency: string): number {
  return 10 ** -currencyFractionDigits(currency)
}
