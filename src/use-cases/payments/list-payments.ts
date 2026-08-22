import { paymentGateway } from '@/gateways/payment-gateway'

export async function listPayments(schoolId: string) {
  return paymentGateway.list(schoolId)
}
