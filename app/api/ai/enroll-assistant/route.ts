import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai'
import { after, NextResponse } from 'next/server'
import { AI_ASSISTANT_LIMITS, resolveAiAssistantModel } from '@/domain/ai-assistant'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { createRateLimiter } from '@/lib/rate-limit'
import { getSchoolContext, isActiveSchoolAdmin } from '@/lib/school-context'
import { normalizeChatMessages } from '@/use-cases/ai-assistant/normalize-chat-messages'
import { sanitizeImage } from '@/use-cases/ai-assistant/sanitize-image'
import { enrollmentProposalSchema, PROPOSE_ENROLLMENT_TOOL } from '@/use-cases/ai-assistant/schemas'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { purgeExpiredDrafts } from '@/use-cases/mcp/purge-expired-drafts'
import { isAiAssistantEnabled } from '@/use-cases/platform-settings/is-ai-assistant-enabled'
import { readOpenRouterApiKey } from '@/use-cases/platform-settings/openrouter-api-key'
import { toProviderErrorCode } from './_lib/provider-error'
import { isSameOriginJsonRequest } from './_lib/same-origin'
import { buildSystemPrompt } from './_lib/system-prompt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

const REFUSAL_STATUS = {
  invalidRequest: 400,
  tooManyMessages: 400,
  messageTooLong: 400,
  tooManyImages: 400,
  imageTooLarge: 413,
  forbiddenFile: 415,
  unreadableImage: 422,
} as const

/**
 * Budget par administrateur et par école : la clé est l'identité de session, pas
 * l'adresse. Chaque requête coûte un appel facturé au fournisseur, d'où une fenêtre
 * serrée par rapport au MCP.
 */
const isUserRateLimited = createRateLimiter({
  limit: AI_ASSISTANT_LIMITS.requestsPerMinute,
  windowMs: 60 * 1000,
})

function denied(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

/**
 * Ordre des gardes : origine, session, rôle, drapeau, clé, budget, corps.
 *
 * La session et le rôle sont revérifiés à chaque tour de conversation, sans mémoire
 * entre deux requêtes ; un administrateur retiré de l'école est refusé au tour suivant.
 * Le drapeau passe avant la clé : fermé, la clé chiffrée n'est même pas déchiffrée.
 * Le corps est lu en dernier, une fois l'appelant reconnu, pour ne pas décoder les
 * images d'un inconnu.
 *
 * Le modèle ne dispose que de `propose_enrollment`, dont l'exécution renvoie un accusé :
 * aucun outil ne lit ni n'écrit en base. L'aperçu et la confirmation passent par des
 * actions serveur distinctes, appelées par l'humain.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOriginJsonRequest(request)) return denied('forbidden', 403)

    const context = await getSchoolContext()
    if (!context) return denied('unauthorized', 401)
    if (!isActiveSchoolAdmin(context)) return denied('forbidden', 403)

    const now = new Date()
    // Même horloge que le MCP : un brouillon de session expire comme un brouillon de clé,
    // et son balayage ne dépend pas de l'ouverture du service.
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

    const normalized = await normalizeChatMessages(body, sanitizeImage)
    if (normalized.status !== 'OK') {
      return denied(normalized.status, REFUSAL_STATUS[normalized.status])
    }

    const [classPeriods, plans, paymentsEnabled] = await Promise.all([
      mcpReadGateway.listClassPeriods(context.schoolId),
      mcpReadGateway.listPlans(context.schoolId),
      isPaymentsEnabled(context.schoolId),
    ])

    const tools = {
      [PROPOSE_ENROLLMENT_TOOL]: tool({
        description:
          'Submit the structured enrollment proposal read from the sheet or the text. ' +
          'Leave unknown fields out and list them in `missing`.',
        inputSchema: enrollmentProposalSchema,
        execute: async () => ({ status: 'proposed' as const }),
      }),
    }

    const messages = await convertToModelMessages(normalized.messages, {
      tools,
      ignoreIncompleteToolCalls: true,
    })

    const openrouter = createOpenRouter({ apiKey })
    const result = streamText({
      model: openrouter(resolveAiAssistantModel(process.env.AI_ASSISTANT_MODEL)),
      system: buildSystemPrompt({
        classNames: classPeriods.map((classPeriod) => classPeriod.name),
        planNames: paymentsEnabled ? plans.map((plan) => plan.name) : [],
        paymentsEnabled,
      }),
      messages,
      tools,
      stopWhen: stepCountIs(AI_ASSISTANT_LIMITS.maxSteps),
      maxOutputTokens: AI_ASSISTANT_LIMITS.maxOutputTokens,
      abortSignal: AbortSignal.timeout(AI_ASSISTANT_LIMITS.timeoutMs),
      onError: ({ error }) => {
        console.error('[api/ai/enroll-assistant] provider error:', toProviderErrorCode(error))
      },
    })

    return result.toUIMessageStreamResponse({
      onError: (error) => toProviderErrorCode(error),
    })
  } catch (error) {
    console.error('[api/ai/enroll-assistant] unexpected error:', error)
    return denied('serverError', 500)
  }
}

export function GET() {
  return denied('methodNotAllowed', 405)
}
