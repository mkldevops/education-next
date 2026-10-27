import { z } from 'zod'
import { SCHOOL_CURRENCIES } from '@/domain/school-currency'
import { paymentGateway } from '@/gateways/payment-gateway'
import { schoolGateway } from '@/gateways/school-gateway'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'

type SchoolGateway = Pick<typeof schoolGateway, 'updateCurrency'>
type PaymentGateway = Pick<typeof paymentGateway, 'hasRecordedAmounts'>

const setSchoolCurrencySchema = z.object({
  schoolId: z.string().min(1),
  currency: z.enum(SCHOOL_CURRENCIES),
})

export type SchoolCurrencySettings = {
  currency: string
  /** Des montants sont déjà enregistrés : la devise ne peut plus changer. */
  locked: boolean
}

export async function getSchoolCurrencySettings(
  schoolId: string,
  paymentGw: PaymentGateway = paymentGateway
): Promise<SchoolCurrencySettings> {
  const [{ currency }, locked] = await Promise.all([
    getSchoolRegionalSettings(schoolId),
    paymentGw.hasRecordedAmounts(schoolId),
  ])
  return { currency, locked }
}

/**
 * Les montants sont stockés sans devise et ne sont jamais convertis : changer de devise
 * avec des paiements actifs relabelliserait 720 € en 720 KMF, et le franc comorien n'a pas
 * de décimales. Le changement n'est donc permis que tant qu'aucun montant ne compte.
 */
export async function setSchoolCurrency(
  input: { schoolId: string; currency: string },
  schoolGw: SchoolGateway = schoolGateway,
  paymentGw: PaymentGateway = paymentGateway
) {
  const parsed = setSchoolCurrencySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, currency } = parsed.data
  const current = await getSchoolRegionalSettings(schoolId)
  if (current.currency === currency) return 'OK' as const

  if (await paymentGw.hasRecordedAmounts(schoolId)) return 'currencyLocked' as const

  await schoolGw.updateCurrency(schoolId, currency)
  return 'OK' as const
}
