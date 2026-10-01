'use server'

import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { createCheckoutSession } from '@/use-cases/payments/create-checkout-session'
import { requireSchoolScope } from './auth-helper'

const inputSchema = z.object({
  locale: z.enum(['fr', 'en']),
})

export async function createOnlinePaymentAction(input: { locale: string }) {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return 'invalidInput' as const

  const scope = await requireSchoolScope()
  if (scope.isAdmin) return 'unauthorized' as const

  const user = await db.user.findUnique({
    where: { id: scope.userId },
    select: { email: true },
  })
  if (!user) return 'unauthorized' as const

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8550').replace(/\/$/, '')

  // Le libellé apparaît sur la page Stripe et le reçu : il suit la langue de la page du parent.
  const t = await getTranslations({
    locale: parsed.data.locale,
    namespace: 'dashboard.pages.familyDetails.onlinePayment',
  })

  return createCheckoutSession({
    schoolId: scope.schoolId,
    familyId: scope.familyId,
    initiatedById: scope.userId,
    customerEmail: user.email,
    locale: parsed.data.locale,
    productName: t('productName'),
    appUrl,
  })
}
