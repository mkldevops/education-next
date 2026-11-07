import { randomBytes } from 'node:crypto'
import { receiptGateway } from '@/gateways/receipt-gateway'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 192 bits aléatoires : le jeton seul autorise la lecture, il ne doit pas se deviner. */
export function newShareToken(): string {
  return randomBytes(24).toString('base64url')
}

export function receiptShareUrl(token: string, locale: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8550'
  return `${appUrl}/${locale}/recu/${token}`
}

/**
 * Jeton du lien public d'un reçu de l'école, créé au premier partage. Un reçu annulé n'a plus
 * de lien : la page publique le refuse aussi.
 */
export async function ensureReceiptShareToken(
  schoolId: string,
  receiptId: string,
  receiptGw = receiptGateway,
  makeToken = newShareToken
) {
  if (!UUID.test(receiptId)) return 'notFound' as const
  const receipt = await receiptGw.ensureShareToken(schoolId, receiptId, makeToken())
  if (!receipt) return 'notFound' as const
  if (receipt.cancelledAt || !receipt.shareToken) return 'cancelled' as const
  return { token: receipt.shareToken }
}

/** Adresses des parents et tuteurs de la famille, sans doublon. */
export async function findReceiptRecipients(
  schoolId: string,
  familyId: string,
  receiptGw = receiptGateway
): Promise<string[]> {
  const rows = await receiptGw.findFamilyRecipients(schoolId, familyId)
  const emails = rows
    .map((row) => row.person.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email))
  return [...new Set(emails)]
}
