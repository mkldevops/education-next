import type { z } from 'zod'
import { validateStudentBirthday } from '@/domain/student'
import { lockActiveFamily } from '@/gateways/family-mutation-lock'
import { db } from '@/lib/db'
import { createStudentSchema } from './schemas'

type Input = z.infer<typeof createStudentSchema>

export async function createStudent(input: Input) {
  const parsed = createStudentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, familyId, person, student } = parsed.data
  if (student.birthday) {
    const birthdayCheck = validateStudentBirthday(student.birthday)
    if (birthdayCheck !== 'OK') return birthdayCheck
  }

  return db.$transaction(async (tx) => {
    if (!(await lockActiveFamily(tx, schoolId, familyId))) return 'notFound' as const
    const createdPerson = await tx.person.create({
      data: { ...person, schoolId, families: { create: { familyId, relationType: 'OTHER' } } },
    })
    return tx.student.create({ data: { ...student, schoolId, personId: createdPerson.id } })
  })
}
