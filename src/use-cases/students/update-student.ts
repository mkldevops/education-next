import type { z } from 'zod'
import { validateStudentBirthday } from '@/domain/student'
import { studentGateway } from '@/gateways/student-gateway'
import { updateStudentSchema } from './schemas'

type Input = z.infer<typeof updateStudentSchema>

export async function updateStudent(input: Input, studentGw = studentGateway) {
  const parsed = updateStudentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const student = await studentGw.findById(parsed.data.schoolId, parsed.data.id)
  if (!student) return 'notFound' as const

  if (parsed.data.birthday) {
    const birthdayCheck = validateStudentBirthday(parsed.data.birthday)
    if (birthdayCheck !== 'OK') return birthdayCheck
  }

  const { schoolId, id, ...updateData } = parsed.data
  const updated = await studentGw.update(schoolId, id, updateData)

  return updated
}
