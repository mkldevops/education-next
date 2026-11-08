import { z } from 'zod'

const manualPaymentMethodSchema = z.enum(['CASH', 'CARD', 'TRANSFER', 'CHECK'])

export type ManualPaymentMethod = z.infer<typeof manualPaymentMethodSchema>

export const recordPaymentSchema = z
  .object({
    schoolId: z.string().min(1),
    familyId: z.uuid(),
    enrollmentId: z.uuid().optional(),
    amount: z.number().refine((n) => n !== 0, { message: 'Amount must not be zero' }),
    method: manualPaymentMethodSchema,
    reference: z.string().max(250).optional(),
    paidAt: z.coerce.date(),
    cashedAt: z.coerce.date().optional(),
    /** Émet un reçu numéroté pour un encaissement (montant positif), au nom de `recordedById`. */
    generateReceipt: z.boolean().optional(),
    recordedById: z.string().min(1).optional(),
  })
  .refine((data) => data.method === 'CHECK' || data.cashedAt === undefined, {
    path: ['cashedAt'],
    message: 'Cash date only applies to check payments',
  })
  .refine((data) => !data.generateReceipt || (data.amount > 0 && data.recordedById), {
    path: ['generateReceipt'],
    message: 'A receipt needs a positive amount and its author',
  })

/** Une ligne de l'historique famille réunit une ligne par inscription : la borne la couvre. */
const CANCEL_PAYMENTS_MAX = 20

export const cancelPaymentsSchema = z.object({
  schoolId: z.string().min(1),
  cancelledById: z.string().min(1),
  paymentIds: z.array(z.uuid()).min(1).max(CANCEL_PAYMENTS_MAX),
  reason: z.string().trim().max(250).optional(),
})
