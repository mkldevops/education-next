import { z } from 'zod'

export const recordPaymentSchema = z.object({
  familyId: z.string().uuid(),
  amount: z.number().refine((n) => n !== 0, { message: 'Amount must not be zero' }),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'CHECK', 'STRIPE']),
  reference: z.string().max(250).optional(),
  paidAt: z.coerce.date(),
  cashedAt: z.coerce.date().optional(),
})
