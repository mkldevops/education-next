import type { z } from 'zod'
import { validateStudentBirthday } from '@/domain/student'
import { familyGateway } from '@/gateways/family-gateway'
import { personGateway } from '@/gateways/person-gateway'
import { studentGateway } from '@/gateways/student-gateway'
import { createStudentSchema } from './schemas'

type Input = z.infer<typeof createStudentSchema>

export async function createStudent(input: Input) {
  const parsed = createStudentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const family = await familyGateway.findById(parsed.data.familyId)
  if (!family) return 'notFound' as const

  const birthdayCheck = validateStudentBirthday(parsed.data.student.birthday)
  if (birthdayCheck !== 'OK') return birthdayCheck

  const person = await personGateway.create(parsed.data.person)
  const student = await studentGateway.create({
    personId: person.id,
    ...parsed.data.student,
  })

  await familyGateway.addPerson(parsed.data.familyId, person.id, 'OTHER')

  return student
}
