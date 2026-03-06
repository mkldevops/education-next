import { z } from 'zod'
import { studentGateway } from '@/gateways/student-gateway'

const deactivateStudentSchema = z.object({
  id: z.string().uuid(),
})

type Input = z.infer<typeof deactivateStudentSchema>

export async function deactivateStudent(input: Input) {
  const parsed = deactivateStudentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const student = await studentGateway.findById(parsed.data.id)
  if (!student) return 'notFound' as const

  const hasActive = await studentGateway.hasActiveEnrollments(parsed.data.id)
  if (hasActive) return 'hasActiveEnrollments' as const

  await studentGateway.deactivate(parsed.data.id)

  return 'OK' as const
}
