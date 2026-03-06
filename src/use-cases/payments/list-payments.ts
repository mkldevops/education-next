import { paymentGateway } from '@/gateways/payment-gateway'

export async function listPayments() {
  return paymentGateway.list()
}
