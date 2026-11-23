import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import * as Sentry from '@sentry/nextjs'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  AI_ASSISTANT_SUMMARY_LIMITS,
  assistantSummaryTranscript,
  resolveAiAssistantModel,
} from '@/domain/ai-assistant'
import { getSchoolContext, isActiveSchoolAdmin } from '@/lib/school-context'
import { isAiAssistantEnabled } from '@/use-cases/platform-settings/is-ai-assistant-enabled'
import { readOpenRouterApiKey } from '@/use-cases/platform-settings/openrouter-api-key'
import { toProviderErrorCode } from '../../_lib/provider-error'
import { isSameOriginJsonRequest } from '../../_lib/same-origin'
import { isAssistantUserRateLimited } from '../_lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

/**
 * Entrée propre au résumé : il sert justement les conversations que `normalizeChatMessages`
 * refuse (trop de messages, trop de résultats d'outils), et peut finir sur une réponse.
 * Les parties restent opaques ; la transcription n'en garde que le texte et l'issue des outils.
 */
const summaryRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        parts: z.array(z.unknown()).max(200),
      })
    )
    .min(1)
    .max(AI_ASSISTANT_SUMMARY_LIMITS.maxMessages * 2),
})

const SYSTEM = `Tu résumes une conversation entre un administrateur d'école et l'assistant de gestion, pour qu'elle se poursuive dans une nouvelle conversation qui ne verra que ce résumé.

Règles :
- Écris en français, en texte simple, sous forme de puces courtes regroupées sous : « Contexte », « Fait », « Non fait ou en attente », « Prochaine étape ». Chaque intitulé tient sur sa propre ligne en gras (**Contexte**), jamais en titre Markdown (#), ni en tableau.
- Recopie à l'identique les noms, prénoms, familles, classes, identifiants, montants et dates utiles. N'invente rien ; ce qui est incertain se dit incertain.
- Une ligne TOOL [executed] est une action réellement faite ou une lecture obtenue. [refused], [failed], [awaiting-validation-not-done] et [not-done] ne sont PAS faits : range-les sous « Non fait ou en attente » avec leur raison.
- Une écriture non faite devra être proposée à nouveau et validée : ne la présente jamais comme acquise.
- Garde ce qui sert à poursuivre ; laisse de côté les politesses et les détails épuisés.
- Au plus ${AI_ASSISTANT_SUMMARY_LIMITS.maxSummaryChars - 500} caractères.`

function denied(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

/**
 * Résumé d'une conversation trop chargée, pour amorcer la suivante. Mêmes gardes et même
 * compteur que l'assistant ; aucun outil n'est offert au modèle, qui ne fait que résumer.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOriginJsonRequest(request)) return denied('forbidden', 403)

    const context = await getSchoolContext()
    if (!context) return denied('unauthorized', 401)
    if (!isActiveSchoolAdmin(context)) return denied('forbidden', 403)

    if (!(await isAiAssistantEnabled())) return denied('aiAssistantDisabled', 503)

    const apiKey = await readOpenRouterApiKey()
    if (apiKey === null) return denied('aiAssistantNotConfigured', 503)

    if (isAssistantUserRateLimited(`${context.userId}:${context.schoolId}`)) {
      return denied('tooManyRequests', 429)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return denied('invalidRequest', 400)
    }
    const parsed = summaryRequestSchema.safeParse(body)
    if (!parsed.success) return denied('invalidRequest', 400)

    const transcript = assistantSummaryTranscript(
      parsed.data.messages.slice(-AI_ASSISTANT_SUMMARY_LIMITS.maxMessages)
    )
    if (!transcript) return denied('invalidRequest', 400)

    const model = createOpenRouter({ apiKey })(
      resolveAiAssistantModel(process.env.AI_ASSISTANT_MODEL),
      { reasoning: { max_tokens: AI_ASSISTANT_SUMMARY_LIMITS.maxReasoningTokens } }
    )
    const result = await generateText({
      model,
      system: SYSTEM,
      prompt: `Conversation à résumer :\n\n${transcript}`,
      maxOutputTokens: AI_ASSISTANT_SUMMARY_LIMITS.maxOutputTokens,
      abortSignal: AbortSignal.timeout(AI_ASSISTANT_SUMMARY_LIMITS.timeoutMs),
    })

    const text = result.text.trim()
    if (!text) return denied('providerError', 502)
    if (result.finishReason !== 'stop') {
      Sentry.captureMessage(`AI assistant summary ended: ${result.finishReason}`, {
        level: 'warning',
        tags: { feature: 'ai-assistant-summary', finishReason: result.finishReason },
      })
    }
    const max = AI_ASSISTANT_SUMMARY_LIMITS.maxSummaryChars
    const summary = text.length > max ? `${text.slice(0, max - 1)}…` : text
    return NextResponse.json({ summary })
  } catch (error) {
    const code = toProviderErrorCode(error)
    console.error('[api/ai/assistant/summary] provider error:', code)
    Sentry.captureException(error, { tags: { feature: 'ai-assistant-summary', code } })
    return denied(code, 502)
  }
}
