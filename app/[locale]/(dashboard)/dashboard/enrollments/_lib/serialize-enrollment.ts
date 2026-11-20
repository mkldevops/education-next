import { type DecimalLike, toNumber, toNumberOrNull } from '@/lib/decimal'

type PlanMoney = { amount: DecimalLike; pricing: unknown }
type PaymentMoney = { amount: DecimalLike }
type EnrollmentMoney<P extends PlanMoney, T extends PaymentMoney> = {
  totalAmount: DecimalLike
  discount: DecimalLike
  writeOffAmount: DecimalLike | null
  firstInstallmentAmount: DecimalLike | null
  plan: P
  payments: T[]
}

/**
 * Une inscription prête pour le tableau client : plus aucun `Decimal`, et rien de financier
 * pour qui n'est pas administrateur — un enseignant ne reçoit ni total, ni remise, ni premier
 * mois réduit, ni tarif de formule, ni paiement, même masqués par l'interface.
 */
export function serializeEnrollment<
  P extends PlanMoney,
  T extends PaymentMoney,
  E extends EnrollmentMoney<P, T>,
>(
  enrollment: E & EnrollmentMoney<P, T>,
  { isAdmin }: { isAdmin: boolean }
): Omit<E, keyof EnrollmentMoney<P, T>> & {
  totalAmount: number
  discount: number
  writeOffAmount: number | null
  firstInstallmentAmount: number | null
  plan: Omit<P, keyof PlanMoney> & { amount: number; pricing: P['pricing'] | null }
  payments: Array<Omit<T, 'amount'> & { amount: number }>
} {
  const { totalAmount, discount, writeOffAmount, firstInstallmentAmount, plan, payments, ...rest } =
    enrollment
  const { amount, pricing, ...planRest } = plan
  if (!isAdmin) {
    return {
      ...rest,
      totalAmount: 0,
      discount: 0,
      writeOffAmount: null,
      firstInstallmentAmount: null,
      plan: { ...planRest, amount: 0, pricing: null },
      payments: [],
    }
  }
  return {
    ...rest,
    totalAmount: toNumber(totalAmount),
    discount: toNumber(discount),
    writeOffAmount: toNumberOrNull(writeOffAmount),
    firstInstallmentAmount: toNumberOrNull(firstInstallmentAmount),
    plan: { ...planRest, amount: toNumber(amount), pricing },
    payments: payments.map(serializePayment),
  }
}

function serializePayment<T extends PaymentMoney>(
  payment: T
): Omit<T, 'amount'> & {
  amount: number
} {
  const { amount, ...rest } = payment
  return { ...rest, amount: toNumber(amount) }
}
