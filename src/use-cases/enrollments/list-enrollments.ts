import { enrollmentGateway } from '@/gateways/enrollment-gateway'

export async function listEnrollments(schoolId: string) {
  return enrollmentGateway.list(schoolId)
}
