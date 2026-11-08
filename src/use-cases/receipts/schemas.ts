import { z } from 'zod'
import { MealService } from '@/generated/prisma/enums'

/** Moyens acceptés en caisse : le paiement en ligne passe par Stripe, la carte par l'écolage. */
const cashierPaymentMethodSchema = z.enum(['CASH', 'MOBILE_MONEY', 'TRANSFER', 'CHECK'])

export type CashierPaymentMethod = z.infer<typeof cashierPaymentMethodSchema>

const mealLineSchema = z.object({
  studentId: z.uuid(),
  service: z.enum(MealService),
  amount: z.number().positive(),
  expectedPaidThrough: z.iso.date().nullable(),
})

const childcareLineSchema = z.object({
  chargeId: z.uuid(),
  amount: z.number().positive(),
})

export const recordReceiptSchema = z
  .object({
    schoolId: z.string().min(1),
    recordedById: z.string().min(1),
    idempotencyKey: z.uuid(),
    familyId: z.uuid(),
    method: cashierPaymentMethodSchema,
    reference: z.string().trim().max(250).optional(),
    tuition: z.number().min(0),
    /** Écolage porté sur une seule inscription au lieu d'être réparti sur la famille. */
    tuitionEnrollmentId: z.uuid().optional(),
    meals: z.array(mealLineSchema).max(20),
    childcare: z.array(childcareLineSchema).max(60).default([]),
  })
  .refine((data) => data.tuition > 0 || data.meals.length + data.childcare.length > 0, {
    path: ['meals'],
    message: 'A receipt needs at least one line',
  })
  .refine((data) => data.tuitionEnrollmentId === undefined || data.tuition > 0, {
    path: ['tuitionEnrollmentId'],
    message: 'A tuition target needs a tuition amount',
  })
  .refine(
    (data) =>
      new Set(data.meals.map((line) => `${line.studentId}:${line.service}`)).size ===
      data.meals.length,
    { path: ['meals'], message: 'One line per student and service' }
  )
  .refine(
    (data) => new Set(data.childcare.map((line) => line.chargeId)).size === data.childcare.length,
    {
      path: ['childcare'],
      message: 'One line per billed month',
    }
  )

export const cancelReceiptSchema = z.object({
  schoolId: z.string().min(1),
  cancelledById: z.string().min(1),
  receiptId: z.uuid(),
  reason: z.string().trim().min(1).max(250),
})

export const issueReceiptForPaymentsSchema = z.object({
  schoolId: z.string().min(1),
  recordedById: z.string().min(1),
  paymentIds: z.array(z.uuid()).min(1).max(20),
})
