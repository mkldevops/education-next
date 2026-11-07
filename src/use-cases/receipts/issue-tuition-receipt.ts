import { createHash } from 'node:crypto'
import { receiptGateway } from '@/gateways/receipt-gateway'
import type { PaymentMethod, Prisma } from '@/generated/prisma/client'

type Tx = Prisma.TransactionClient

export type TuitionReceiptInput = {
  familyId: string
  method: PaymentMethod
  reference: string | null
  paidAt: Date
  /** Nul pour un paiement en ligne, sans auteur dans l'école. */
  recordedById: string | null
  /** Clé stable de l'émission : deux émissions pour la même origine se heurtent à l'unicité. */
  idempotencyKey: string
  payments: ReadonlyArray<{ id: string; amount: number }>
}

/**
 * Reçu numéroté d'un règlement d'écolage déjà écrit dans `tx` : il prend le numéro suivant de
 * l'école et se rattache les lignes de paiement. L'appelant tient le verrou de la famille et
 * ne passe que des lignes positives sans reçu.
 */
export async function issueTuitionReceipt(
  tx: Tx,
  schoolId: string,
  input: TuitionReceiptInput,
  receiptGw = receiptGateway
): Promise<{ id: string }> {
  const ids = input.payments.map((payment) => payment.id)
  const cents = input.payments.reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0)
  const requestHash = createHash('sha256')
    .update(JSON.stringify({ familyId: input.familyId, payments: [...ids].sort() }))
    .digest('hex')

  const number = await receiptGw.nextNumber(tx, schoolId)
  const receipt = await receiptGw.create(tx, schoolId, {
    familyId: input.familyId,
    number,
    total: cents / 100,
    method: input.method,
    reference: input.reference,
    paidAt: input.paidAt,
    recordedById: input.recordedById,
    idempotencyKey: input.idempotencyKey,
    requestHash,
  })
  const attached = await receiptGw.attachPayments(tx, schoolId, receipt.id, ids)
  if (attached.count !== ids.length) {
    throw new Error('Receipt payments changed while issuing the receipt')
  }
  return receipt
}
