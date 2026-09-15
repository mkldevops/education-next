import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { isTeacherExpensesEnabled } from '@/use-cases/config/is-teacher-expenses-enabled'
import { createTeacherExpenseSchema } from './schemas'

type Input = z.infer<typeof createTeacherExpenseSchema>

export async function createTeacherExpense(
  input: Input,
  teacherGw = teacherGateway,
  configGw = configGateway
) {
  const parsed = createTeacherExpenseSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, ...data } = parsed.data
  const enabled = await isTeacherExpensesEnabled(schoolId, configGw)
  if (!enabled) return 'notConfigured' as const

  const teacher = await teacherGw.findById(schoolId, data.teacherId)
  if (!teacher) return 'notFound' as const

  return teacherGw.createExpense(schoolId, data)
}
