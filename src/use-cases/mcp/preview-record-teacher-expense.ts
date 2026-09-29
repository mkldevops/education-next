import type { z } from 'zod'
import type { McpFinding } from '@/domain/mcp-draft'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { isTeacherExpensesEnabled } from '@/use-cases/config/is-teacher-expenses-enabled'
import { blockedPreview, saveDraftPreview } from './draft-response'
import type { DraftScope } from './draft-scope'
import { matchTeacher } from './match-by-name'
import { previewRecordTeacherExpenseSchema } from './schemas'

type Input = z.input<typeof previewRecordTeacherExpenseSchema>

export const RECORD_TEACHER_EXPENSE_TOOL = 'record_teacher_expense'

const DAY_MS = 24 * 60 * 60 * 1000

/** Le jour courant à minuit UTC, là où le formulaire du tableau de bord range un jour saisi. */
function todayUtc(now: Date) {
  return new Date(now.toISOString().slice(0, 10))
}

async function resolveTeacher(
  schoolId: string,
  data: { teacherId?: string; teacherName?: string }
) {
  if (data.teacherId) {
    const teacher = await mcpReadGateway.findTeacher(schoolId, data.teacherId)
    return { field: 'teacherId', value: data.teacherId, candidates: teacher ? [teacher] : [] }
  }
  const label = data.teacherName ?? ''
  const candidates = matchTeacher(await mcpReadGateway.listTeachers(schoolId), label)
  return { field: 'teacherName', value: label, candidates }
}

/**
 * Résout une note de dépense en plan écrit, sans rien créer : l'humain relit l'enseignant,
 * le montant et les dates avant l'écriture financière. Une note identique déjà saisie — même
 * enseignant, même montant, même jour — est signalée, pas refusée : deux goûters du même prix
 * le même samedi existent.
 */
export async function previewRecordTeacherExpense(
  scope: DraftScope,
  input: Input,
  now: () => Date = () => new Date()
) {
  const parsed = previewRecordTeacherExpenseSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  if (!(await isTeacherExpensesEnabled(schoolId))) return 'notConfigured' as const
  const data = parsed.data

  const warnings: McpFinding[] = []
  const blockers: McpFinding[] = []

  const lookup = await resolveTeacher(schoolId, data)
  const matches = { teachers: lookup.candidates }
  if (lookup.candidates.length !== 1) {
    blockers.push({
      field: lookup.field,
      value: lookup.value,
      reason: lookup.candidates.length === 0 ? 'notFound' : 'ambiguousTeacher',
    })
    return blockedPreview(matches, warnings, blockers)
  }
  const teacher = lookup.candidates[0]

  const requestedAt = data.requestedAt ? new Date(data.requestedAt) : todayUtc(now())
  const paidAt = data.paidAt ? new Date(data.paidAt) : null
  // Le tableau de bord l'accepte : c'est une lecture à vérifier, pas un refus.
  if (paidAt && paidAt < requestedAt) {
    warnings.push({ field: 'paidAt', value: data.paidAt ?? '', reason: 'paidBeforeRequested' })
  }

  const similar = await teacherGateway.findSimilarExpenses(schoolId, {
    teacherId: teacher.id,
    amount: data.amount,
    requestedFrom: requestedAt,
    requestedBefore: new Date(requestedAt.getTime() + DAY_MS),
  })
  for (const expense of similar) {
    warnings.push({ field: 'amount', value: expense.id, reason: 'possibleDuplicateExpense' })
  }

  const resolved = {
    tool: RECORD_TEACHER_EXPENSE_TOOL,
    teacher,
    amount: data.amount,
    category: data.category,
    description: data.description,
    requestedAt: requestedAt.toISOString(),
    paidAt: paidAt?.toISOString() ?? null,
  }

  return saveDraftPreview(scope, RECORD_TEACHER_EXPENSE_TOOL, resolved, matches, warnings, blockers)
}
