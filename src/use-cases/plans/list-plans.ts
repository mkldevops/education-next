import { planGateway } from '@/gateways/plan-gateway'

export async function listPlans() {
  return planGateway.list()
}
