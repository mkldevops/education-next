'use server'

import { revalidatePath } from 'next/cache'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { commitEnrollFamily } from '@/use-cases/mcp/commit-enroll-family'
import type { DraftScope } from '@/use-cases/mcp/draft-scope'
import { previewEnrollFamily } from '@/use-cases/mcp/preview-enroll-family'
import { commitDraftSchema, previewEnrollFamilySchema } from '@/use-cases/mcp/schemas'
import { isAiAssistantEnabled } from '@/use-cases/platform-settings/is-ai-assistant-enabled'
import { requireSchoolAdmin } from './auth-helper'

type Finding = { field: string; value: string; reason: string }

type Matches = {
  families: { id: string; name: string }[]
  students: { id: string; name: string; lastname: string; isStudent: boolean }[]
}

type ResolvedPlan = NonNullable<
  Exclude<Awaited<ReturnType<typeof previewEnrollFamily>>, string>['plan']
>

/**
 * Ce que l'écran affiche du plan résolu : les libellés retrouvés en base, pas le brouillon
 * complet. Les identifiants internes et l'auteur restent côté serveur.
 */
export type PreviewPlanSummary = {
  family: { existing: boolean; name: string }
  parentCount: number
  students: {
    name: string
    lastname: string
    className: string
    planName: string
    amount: number
  }[]
  payment: { amount: number; method: string } | null
}

export type AssistantPreviewResult =
  | { status: 'aiAssistantDisabled' }
  | { status: 'validationError'; fields: string[] }
  | { status: 'blocked'; matches: Matches; warnings: Finding[]; blockers: Finding[] }
  | {
      status: 'preview'
      draftId: string
      checksum: string
      plan: PreviewPlanSummary
      matches: Matches
      warnings: Finding[]
      blockers: Finding[]
    }

function summarizePlan(plan: ResolvedPlan): PreviewPlanSummary {
  return {
    family: { existing: 'id' in plan.family, name: plan.family.name },
    parentCount: plan.parents.length,
    students: plan.students.map((student) => ({
      name: student.name,
      lastname: student.lastname,
      className: student.classPeriod.name,
      planName: student.plan.name,
      amount: student.totalAmount,
    })),
    payment: plan.payment ? { amount: plan.payment.amount, method: plan.payment.method } : null,
  }
}

export type AssistantConfirmResult =
  | { status: 'aiAssistantDisabled' }
  | { status: 'validationError' }
  | { status: 'refused'; reason: string }
  | {
      status: 'committed'
      familyId: string
      studentIds: string[]
      enrollmentIds: string[]
      paymentIds: string[]
    }

/**
 * La portée d'un brouillon de session : l'école active, l'administrateur signataire, et un
 * propriétaire `ADMIN_SESSION` distinct de toute clé MCP. Un brouillon préparé par une clé
 * ne se confirme pas depuis l'écran, ni l'inverse, même pour le même utilisateur.
 */
async function sessionScope(): Promise<DraftScope | 'aiAssistantDisabled'> {
  const { schoolId, userId } = await requireSchoolAdmin()

  // Relu à chaque appel, après l'identité : couper l'assistant ferme aussi la confirmation
  // d'un brouillon préparé avant la coupure.
  if (!(await isAiAssistantEnabled())) return 'aiAssistantDisabled'

  return {
    schoolId,
    userId,
    paymentsEnabled: await isPaymentsEnabled(schoolId),
    owner: { kind: 'ADMIN_SESSION', userId },
  }
}

/**
 * Aperçu métier depuis le formulaire corrigé par l'humain, jamais depuis le modèle. Rien
 * n'est écrit hormis le brouillon technique, et l'erreur de validation nomme les champs
 * pour que le formulaire les signale.
 */
export async function previewAssistantEnrollmentAction(
  input: unknown
): Promise<AssistantPreviewResult> {
  const scope = await sessionScope()
  if (scope === 'aiAssistantDisabled') return { status: 'aiAssistantDisabled' }

  const parsed = previewEnrollFamilySchema.safeParse(input)
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))]
    return { status: 'validationError', fields }
  }

  const result = await previewEnrollFamily(scope, parsed.data)
  if (result === 'validationError') return { status: 'validationError', fields: [] }

  const { matches, warnings, blockers } = result
  if (result.draftId === null || result.checksum === null) {
    return { status: 'blocked', matches, warnings, blockers }
  }

  return {
    status: 'preview',
    draftId: result.draftId,
    checksum: result.checksum,
    plan: summarizePlan(result.plan),
    matches,
    warnings,
    blockers,
  }
}

/**
 * Seul chemin d'écriture : l'humain clique « Confirmer » sur un aperçu identifié par son
 * brouillon et sa somme de contrôle. Le verrou, le rejeu et les règles métier restent
 * ceux de `commitEnrollFamily`.
 */
export async function confirmAssistantEnrollmentAction(
  input: unknown
): Promise<AssistantConfirmResult> {
  const scope = await sessionScope()
  if (scope === 'aiAssistantDisabled') return { status: 'aiAssistantDisabled' }

  const parsed = commitDraftSchema.safeParse(input)
  if (!parsed.success) return { status: 'validationError' }

  const result: unknown = await commitEnrollFamily(scope, parsed.data)
  if (typeof result === 'string') {
    return result === 'validationError'
      ? { status: 'validationError' }
      : { status: 'refused', reason: result }
  }

  const written = result as {
    familyId: string
    studentIds: string[]
    enrollmentIds: string[]
    paymentIds: string[]
  }

  revalidatePath('/dashboard/enrollments')
  revalidatePath('/dashboard/families', 'layout')
  revalidatePath('/dashboard/students', 'layout')
  if (written.paymentIds.length > 0) revalidatePath('/dashboard/payments')

  return {
    status: 'committed',
    familyId: written.familyId,
    studentIds: written.studentIds,
    enrollmentIds: written.enrollmentIds,
    paymentIds: written.paymentIds,
  }
}
