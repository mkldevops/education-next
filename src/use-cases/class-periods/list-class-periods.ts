import { classPeriodGateway } from '@/gateways/class-period-gateway'

export async function listClassPeriods() {
  return classPeriodGateway.list()
}
