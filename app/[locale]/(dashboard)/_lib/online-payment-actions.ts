'use server'

import { z } from 'zod'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { db } from '@/lib/db'
import { createCheckoutSession } from '@/use-cases/payments/create-checkout-session'
import { getSessionWithRole } from './auth-helper'

const inputSchema = z.object({
  locale: z.enum(['fr', 'en']),
})

export async function createOnlinePaymentAction(input: { locale: string }) {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput' as const

  const { userId, role, familyId } = await getSessionWithRole()
  if (role !== 'PARENT' || !familyId) return 'unauthorized' as const

  const [user, periodId] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
    getSelectedPeriodId(),
  ])
  if (!user) return 'unauthorized' as const

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8550').replace(/\/$/, '')

  return createCheckoutSession({
    familyId,
    initiatedById: userId,
    customerEmail: user.email,
    locale: parsed.data.locale,
    appUrl,
    periodId,
  })
}
