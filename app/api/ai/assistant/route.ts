import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { convertToModelMessages, generateId, stepCountIs, streamText } from 'ai'
import { after, NextResponse } from 'next/server'
import { AI_ASSISTANT_LIMITS, resolveAiAssistantModel } from '@/domain/ai-assistant'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { createRateLimiter } from '@/lib/rate-limit'
import { getSchoolContext, isActiveSchoolAdmin } from '@/lib/school-context'
import { normalizeChatMessages } from '@/use-cases/ai-assistant/normalize-chat-messages'
import { sanitizeImage } from '@/use-cases/ai-assistant/sanitize-image'
import { saveConversation } from '@/use-cases/ai-assistant/save-conversation'
import { findSelectedFamily } from '@/use-cases/ai-assistant/selected-family'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { purgeExpiredDrafts } from '@/use-cases/mcp/purge-expired-drafts'
import { isAiAssistantEnabled } from '@/use-cases/platform-settings/is-ai-assistant-enabled'
import { readOpenRouterApiKey } from '@/use-cases/platform-settings/openrouter-api-key'
import { toProviderErrorCode } from '../_lib/provider-error'
import { isSameOriginJsonRequest } from '../_lib/same-origin'
import { buildAssistantTools, toolApprovalSecret } from './_lib/assistant-tools'
import { prepareAssistantStep } from './_lib/commit-after-preview'
import { buildAssistantSystemPrompt } from './_lib/system-prompt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const REFUSAL_STATUS = {
  invalidRequest: 400,
  tooManyMessages: 400,
  messageTooLong: 400,
  tooManyImages: 400,
  imageTooLarge: 413,
  forbiddenFile: 415,
  unreadableImage: 422,
} as const

const PAGE_PATTERN = /^\/[\w\-/]{0,200}$/

const isUserRateLimited = createRateLimiter({
  limit: AI_ASSISTANT_LIMITS.requestsPerMinute,
  windowMs: 60 * 1000,
})

function denied(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

function readConversationId(body: unknown) {
  return typeof body === 'object' && body !== null && 'id' in body ? body.id : null
}

function readFamilyId(body: unknown) {
  return typeof body === 'object' && body !== null && 'familyId' in body ? body.familyId : null
}

function readPage(body: unknown) {
  if (typeof body !== 'object' || body === null || !('page' in body)) return null
  return typeof body.page === 'string' && PAGE_PATTERN.test(body.page) ? body.page : null
}

/**
 * Assistant général : mêmes gardes que l'assistant d'inscription, mais le modèle reçoit
 * le catalogue d'outils du MCP, cantonné à l'école de la session.
 *
 * Les lectures et les aperçus s'exécutent directement. Chaque écriture s'arrête sur une
 * demande de validation ; la réponse de l'administrateur revient au tour suivant, signée
 * par le serveur, et l'AI SDK refuse une approbation dont la signature ne correspond pas.
 * Session, rôle et drapeaux sont relus à chaque tour : une approbation n'exécute rien
 * pour un appelant qui a perdu ses droits entre-temps.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOriginJsonRequest(request)) return denied('forbidden', 403)

    const context = await getSchoolContext()
    if (!context) return denied('unauthorized', 401)
    if (!isActiveSchoolAdmin(context)) return denied('forbidden', 403)

    const now = new Date()
    after(() => purgeExpiredDrafts(now))

    if (!(await isAiAssistantEnabled())) return denied('aiAssistantDisabled', 503)

    const apiKey = await readOpenRouterApiKey()
    if (apiKey === null) return denied('aiAssistantNotConfigured', 503)

    if (isUserRateLimited(`${context.userId}:${context.schoolId}`)) {
      return denied('tooManyRequests', 429)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return denied('invalidRequest', 400)
    }

    const paymentsEnabled = await isPaymentsEnabled(context.schoolId)
    const approvalSecret = toolApprovalSecret()
    const { tools, toolApproval, toolNames } = buildAssistantTools(
      {
        schoolId: context.schoolId,
        userId: context.userId,
        paymentsEnabled,
        owner: { kind: 'ADMIN_SESSION', userId: context.userId },
      },
      approvalSecret
    )

    const normalized = await normalizeChatMessages(body, sanitizeImage, { toolNames })
    if (normalized.status !== 'OK') {
      return denied(normalized.status, REFUSAL_STATUS[normalized.status])
    }

    const messages = await convertToModelMessages(normalized.messages, {
      tools,
      ignoreIncompleteToolCalls: true,
    })

    const [period, family] = await Promise.all([
      getSelectedPeriod(context.schoolId),
      findSelectedFamily(context.schoolId, readFamilyId(body)),
    ])
    const openrouter = createOpenRouter({ apiKey })
    const result = streamText({
      model: openrouter(resolveAiAssistantModel(process.env.AI_ASSISTANT_MODEL)),
      system: buildAssistantSystemPrompt({
        paymentsEnabled,
        today: now.toISOString().slice(0, 10),
        page: readPage(body),
        period,
        family,
      }),
      messages,
      tools,
      toolApproval,
      ...(approvalSecret ? { experimental_toolApprovalSecret: approvalSecret } : {}),
      stopWhen: stepCountIs(AI_ASSISTANT_LIMITS.maxAgentSteps),
      prepareStep: ({ steps }) =>
        prepareAssistantStep(steps, toolNames, AI_ASSISTANT_LIMITS.maxAgentSteps),
      maxOutputTokens: AI_ASSISTANT_LIMITS.maxOutputTokens,
      abortSignal: AbortSignal.timeout(AI_ASSISTANT_LIMITS.agentTimeoutMs),
      onError: ({ error }) => {
        console.error('[api/ai/assistant] provider error:', toProviderErrorCode(error))
      },
    })

    const scope = { schoolId: context.schoolId, userId: context.userId }
    const conversationId = readConversationId(body)

    // La conversation s'enregistre à la fin de chaque tour, photos retirées : l'historique
    // suit l'administrateur d'un appareil à l'autre.
    return result.toUIMessageStreamResponse({
      originalMessages: normalized.messages,
      generateMessageId: generateId,
      onFinish: async ({ messages: finished }) => {
        await saveConversation(scope, conversationId, finished)
      },
      onError: (error) => toProviderErrorCode(error),
    })
  } catch (error) {
    console.error('[api/ai/assistant] unexpected error:', error)
    return denied('serverError', 500)
  }
}

export function GET() {
  return denied('methodNotAllowed', 405)
}
