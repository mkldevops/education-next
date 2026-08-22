import { periodGateway } from '@/gateways/period-gateway'

export async function listPeriods(schoolId: string) {
  return periodGateway.list(schoolId)
}
