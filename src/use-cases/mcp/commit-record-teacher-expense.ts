import { z } from 'zod'
import { isTeacherExpensesEnabled } from '@/use-cases/config/is-teacher-expenses-enabled'
import { claimResolved, commitInTransaction } from './claim-draft'
import type { DraftScope } from './draft-scope'
import { RECORD_TEACHER_EXPENSE_TOOL } from './preview-record-teacher-expense'
import { commitDraftSchema } from './schemas'

const resolvedSchema = z.object({
  teacher: z.object({ id: z.string(), firstName: z.string(), lastName: z.string() }),
  amount: z.number().positive(),
  category: z.string(),
  description: z.string(),
  requestedAt: z.coerce.date(),
  paidAt: z.coerce.date().nullable(),
})

type Input = z.infer<typeof commitDraftSchema>

export async function commitRecordTeacherExpense(scope: DraftScope, input: Input) {
  const parsed = commitDraftSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  // Refuse même un brouillon préparé avant la coupure, sans le réclamer — un `claimDraft`
  // marquerait un brouillon désormais inengageable.
  if (!(await isTeacherExpensesEnabled(schoolId))) return 'notConfigured' as const

  const claim = await claimResolved(scope, RECORD_TEACHER_EXPENSE_TOOL, input, resolvedSchema)
  if (claim.done) return claim.value
  const { draftId, resolved } = claim

  return commitInTransaction(schoolId, draftId, async (tx) => {
    // Un enseignant archivé depuis le preview ne reçoit plus de note.
    const teacher = await tx.teacher.findFirst({
      where: { id: resolved.teacher.id, schoolId, isActive: true },
      select: { id: true },
    })
    if (!teacher) return 'notFound' as const

    const expense = await tx.teacherExpense.create({
      data: {
        schoolId,
        teacherId: teacher.id,
        amount: resolved.amount,
        category: resolved.category,
        description: resolved.description,
        requestedAt: resolved.requestedAt,
        paidAt: resolved.paidAt,
      },
      select: { id: true },
    })

    return {
      id: expense.id,
      teacherId: teacher.id,
      amount: resolved.amount,
      requestedAt: resolved.requestedAt.toISOString(),
      paidAt: resolved.paidAt?.toISOString() ?? null,
    }
  })
}
