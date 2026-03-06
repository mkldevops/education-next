import { periodGateway } from '@/gateways/period-gateway'

export async function listPeriods() {
  return periodGateway.list()
}
