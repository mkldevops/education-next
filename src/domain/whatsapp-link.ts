/**
 * Indicatif des mobiles d'outre-mer, dont le numéro national commence par `06` comme en
 * métropole : sans eux, un numéro de Mayotte ou de La Réunion partirait vers la France.
 */
const OVERSEAS_MOBILE_PREFIXES: Array<[prefix: string, countryCode: string]> = [
  ['0639', '262'],
  ['0692', '262'],
  ['0693', '262'],
  ['0690', '590'],
  ['0691', '590'],
  ['0694', '594'],
  ['0696', '596'],
  ['0697', '596'],
]

const FRANCE_COUNTRY_CODE = '33'

/**
 * Numéro au format attendu par `wa.me` : indicatif pays puis numéro, chiffres seuls. Un
 * numéro national français à dix chiffres reçoit son indicatif ; un numéro qu'on ne sait pas
 * situer renvoie `null` plutôt qu'un lien vers un inconnu.
 */
export function toWhatsAppNumber(phone: string): string | null {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')

  if (trimmed.startsWith('+')) return digits.length >= 8 ? digits : null
  if (digits.startsWith('00')) return digits.length >= 10 ? digits.slice(2) : null

  if (/^0[1-9]\d{8}$/.test(digits)) {
    const overseas = OVERSEAS_MOBILE_PREFIXES.find(([prefix]) => digits.startsWith(prefix))
    return `${overseas?.[1] ?? FRANCE_COUNTRY_CODE}${digits.slice(1)}`
  }

  return null
}

/** Lien qui ouvre la conversation WhatsApp du numéro, message pré-rempli, sans rien envoyer. */
export function whatsAppLink(phone: string, text: string): string | null {
  const number = toWhatsAppNumber(phone)
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null
}
