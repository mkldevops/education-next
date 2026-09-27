import { isToolUIPart, type UIMessage } from 'ai'

export type DraftPlan = Record<string, unknown>

function planOf(output: unknown): [string, DraftPlan] | null {
  if (typeof output !== 'object' || output === null) return null
  const { draftId, plan } = output as { draftId?: unknown; plan?: unknown }
  if (typeof draftId !== 'string' || typeof plan !== 'object' || plan === null) return null
  return [draftId, plan as DraftPlan]
}

/** Plans résolus par les aperçus du fil, par brouillon : la carte de validation les montre. */
export function draftPlans(messages: UIMessage[]): Map<string, DraftPlan> {
  const plans = new Map<string, DraftPlan>()
  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolUIPart(part) || part.state !== 'output-available') continue
      const entry = planOf(part.output)
      if (entry) plans.set(entry[0], entry[1])
    }
  }
  return plans
}

export function draftIdOf(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null
  const { draftId } = input as { draftId?: unknown }
  return typeof draftId === 'string' ? draftId : null
}
