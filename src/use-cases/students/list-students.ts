import { studentGateway } from '@/gateways/student-gateway'

export async function listStudents() {
  return studentGateway.list()
}
