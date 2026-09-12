import { teacherGateway } from '@/gateways/teacher-gateway'

export async function listTeachers(schoolId: string) {
  return teacherGateway.list(schoolId)
}
