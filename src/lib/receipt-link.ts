import { isLocale } from '@/i18n/locales'

export type ReceiptReturnKind = 'family' | 'cashier' | 'other'

const DASHBOARD_PATH = /^\/dashboard(?:[/?#]|$)/

/** Chemin interne au tableau de bord, sans protocole ni hôte, sinon `null`. */
export function safeReceiptReturnPath(from: string | null | undefined): string | null {
  if (!from || from.length > 512) return null
  if (from.includes('\\') || from.startsWith('//')) return null
  return DASHBOARD_PATH.test(from) ? from : null
}

export function receiptReturnKind(path: string): ReceiptReturnKind {
  const pathname = path.split(/[?#]/)[0]
  if (/^\/dashboard\/families\/[^/]+$/.test(pathname)) return 'family'
  if (pathname === '/dashboard/cashier' || pathname.startsWith('/dashboard/cashier/')) {
    return 'cashier'
  }
  return 'other'
}

/**
 * Page courante du navigateur, sans préfixe de langue ; `null` hors navigateur. L'ancre est gardée :
 * elle porte l'onglet ouvert (`#payments` sur une fiche famille), où le retour doit ramener.
 */
export function currentDashboardPath(): string | null {
  if (typeof window === 'undefined') return null
  const { pathname, search, hash } = window.location
  const [, first, ...rest] = pathname.split('/')
  const path = first && isLocale(first) ? `/${rest.join('/')}` : pathname
  const params = new URLSearchParams(search)
  params.delete('action')
  const query = params.toString()
  return safeReceiptReturnPath(`${query ? `${path}?${query}` : path}${hash}`)
}

/** Lien vers un reçu qui mémorise la page d'origine pour le bouton retour. */
export function receiptHref(
  receiptId: string,
  from?: string | null,
  options: { action?: 'cancel' } = {}
): string {
  const params = new URLSearchParams()
  const safe = safeReceiptReturnPath(from)
  if (options.action) params.set('action', options.action)
  if (safe) params.set('from', safe)
  const query = params.toString()
  return `/dashboard/cashier/receipts/${receiptId}${query ? `?${query}` : ''}`
}
