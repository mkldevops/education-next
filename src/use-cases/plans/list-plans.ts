import { planGateway } from '@/gateways/plan-gateway'

export async function listPlans(schoolId: string) {
  return planGateway.list(schoolId)
}
