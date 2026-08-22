import { classPeriodGateway } from '@/gateways/class-period-gateway'

export async function listClassPeriods(schoolId: string) {
  return classPeriodGateway.list(schoolId)
}
