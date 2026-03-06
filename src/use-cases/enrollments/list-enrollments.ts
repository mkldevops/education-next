import { enrollmentGateway } from '@/gateways/enrollment-gateway'

export async function listEnrollments() {
  return enrollmentGateway.list()
}
