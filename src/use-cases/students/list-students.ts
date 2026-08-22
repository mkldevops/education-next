import { studentGateway } from '@/gateways/student-gateway'

export async function listStudents(schoolId: string) {
  return studentGateway.list(schoolId)
}
