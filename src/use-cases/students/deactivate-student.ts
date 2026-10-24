import { z } from 'zod'
import { studentGateway } from '@/gateways/student-gateway'
import { stopStudentMeals } from '@/use-cases/meals/stop-student-meals'

const deactivateStudentSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
})

type Input = z.infer<typeof deactivateStudentSchema>

export async function deactivateStudent(
  input: Input,
  studentGw = studentGateway,
  stopMeals = stopStudentMeals
) {
  const parsed = deactivateStudentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const student = await studentGw.findById(parsed.data.schoolId, parsed.data.id)
  if (!student) return 'notFound' as const

  const hasActive = await studentGw.hasActiveEnrollments(parsed.data.schoolId, parsed.data.id)
  if (hasActive) return 'hasActiveEnrollments' as const

  await studentGw.deactivate(parsed.data.schoolId, parsed.data.id)
  await stopMeals({ schoolId: parsed.data.schoolId, studentId: parsed.data.id })

  return 'OK' as const
}
