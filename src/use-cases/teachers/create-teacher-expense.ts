import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { TEACHER_EXPENSES_CONFIG_KEY } from '@/lib/teacher-expense-config'
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
  const config = await configGw.get(schoolId, TEACHER_EXPENSES_CONFIG_KEY)
  if (config?.value !== 'true') return 'notConfigured' as const

  const teacher = await teacherGw.findById(schoolId, data.teacherId)
  if (!teacher) return 'notFound' as const

  return teacherGw.createExpense(schoolId, data)
}
