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
  })
  .refine((data) => data.method === 'CHECK' || data.cashedAt === undefined, {
    path: ['cashedAt'],
    message: 'Cash date only applies to check payments',
  })
