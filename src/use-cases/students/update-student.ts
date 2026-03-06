import type { z } from 'zod'
import { validateStudentBirthday } from '@/domain/student'
import { studentGateway } from '@/gateways/student-gateway'
import { updateStudentSchema } from './schemas'

type Input = z.infer<typeof updateStudentSchema>

export async function updateStudent(input: Input) {
  const parsed = updateStudentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const student = await studentGateway.findById(parsed.data.id)
  if (!student) return 'notFound' as const

  if (parsed.data.birthday) {
    const birthdayCheck = validateStudentBirthday(parsed.data.birthday)
    if (birthdayCheck !== 'OK') return birthdayCheck
  }

  const { id, ...updateData } = parsed.data
  const updated = await studentGateway.update(id, updateData)

  return updated
}
