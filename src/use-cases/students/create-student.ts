import type { z } from 'zod'
import { validateStudentBirthday } from '@/domain/student'
import { familyGateway } from '@/gateways/family-gateway'
import { personGateway } from '@/gateways/person-gateway'
import { studentGateway } from '@/gateways/student-gateway'
import { createStudentSchema } from './schemas'

type Input = z.infer<typeof createStudentSchema>

export async function createStudent(
  input: Input,
  familyGw = familyGateway,
  personGw = personGateway,
  studentGw = studentGateway
) {
  const parsed = createStudentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const family = await familyGw.findById(parsed.data.schoolId, parsed.data.familyId)
  if (!family) return 'notFound' as const

  const { birthday } = parsed.data.student
  if (birthday) {
    const birthdayCheck = validateStudentBirthday(birthday)
    if (birthdayCheck !== 'OK') return birthdayCheck
  }

  const person = await personGw.create(parsed.data.schoolId, parsed.data.person)
  const student = await studentGw.create(parsed.data.schoolId, {
    personId: person.id,
    ...parsed.data.student,
  })

  await familyGw.addPerson(parsed.data.schoolId, parsed.data.familyId, person.id, 'OTHER')

  return student
}
