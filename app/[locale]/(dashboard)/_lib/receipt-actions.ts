'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { cancelReceipt } from '@/use-cases/receipts/cancel-receipt'
import { recordReceipt } from '@/use-cases/receipts/record-receipt'
import type { recordReceiptSchema } from '@/use-cases/receipts/schemas'
import {
  ensureReceiptShareToken,
  findReceiptRecipients,
  receiptShareUrl,
} from '@/use-cases/receipts/share-receipt'
import { loadReceiptView } from '../../(print)/_lib/receipt-view'
import { requireSchoolAdmin, requireSchoolCashier, requireSchoolReceipts } from './auth-helper'
import { resolveInvitationLocale } from './invitation-email'
import { sendReceiptEmail } from './receipt-email'

type RecordReceiptInput = z.input<typeof recordReceiptSchema>

export async function recordReceiptAction(
  data: Omit<RecordReceiptInput, 'schoolId' | 'recordedById'>
) {
  const { schoolId, userId } = await requireSchoolCashier()
  const result = await recordReceipt({ ...data, schoolId, recordedById: userId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/cashier')
  revalidatePath(`/dashboard/families/${data.familyId}`)
  return result
}

export async function cancelReceiptAction(receiptId: string, reason: string) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const result = await cancelReceipt({ receiptId, reason, schoolId, cancelledById: userId })
  if (result !== 'OK') return result
  revalidatePath(`/dashboard/cashier/receipts/${receiptId}`)
  revalidatePath('/dashboard/cashier')
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/families/[id]', 'page')
  return 'OK' as const
}

/** Envoie le lien du reçu aux parents et tuteurs de la famille qui ont une adresse. */
export async function sendReceiptEmailAction(receiptId: string, requestedLocale: string) {
  const { schoolId } = await requireSchoolReceipts()
  const locale = resolveInvitationLocale(requestedLocale)
  const shared = await ensureReceiptShareToken(schoolId, receiptId)
  if (typeof shared === 'string') return shared

  const view = await loadReceiptView(schoolId, receiptId, locale)
  if (!view) return 'notFound' as const
  if (!view.familyId) return 'noRecipient' as const
  const to = await findReceiptRecipients(schoolId, view.familyId)
  if (to.length === 0) return 'noRecipient' as const

  return sendReceiptEmail({
    to,
    url: receiptShareUrl(shared.token, locale),
    locale,
    schoolName: view.schoolName ?? '',
    logoUrl: view.logoUrl,
    number: view.number,
    total: view.total,
    paidAt: view.paidAt,
  })
}
