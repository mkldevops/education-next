import type { ModelMessage } from 'ai'
import { activeToolsFor, loadedGroups } from './tool-groups'

type StepToolResult = { toolName: string; output: unknown }
type AssistantStep = {
  toolCalls: ReadonlyArray<{ toolName: string; input?: unknown }>
  toolResults: ReadonlyArray<StepToolResult>
}

function isCleanDraft(output: unknown): boolean {
  if (typeof output !== 'object' || output === null) return false
  const draft = output as { draftId?: unknown; blockers?: unknown }
  return (
    typeof draft.draftId === 'string' &&
    Array.isArray(draft.blockers) &&
    draft.blockers.length === 0
  )
}

/**
 * Un aperçu sans blocage enchaîne sur son `commit_*` à l'étape suivante : la carte
 * d'approbation est la confirmation, le modèle ne doit pas la redemander en texte.
 */
export function commitAfterPreview(
  steps: ReadonlyArray<{ toolResults: ReadonlyArray<StepToolResult> }>,
  toolNames: ReadonlySet<string>
) {
  const last = steps.at(-1)
  if (!last) return undefined
  for (const result of last.toolResults) {
    if (!result.toolName.startsWith('preview_') || !isCleanDraft(result.output)) continue
    const commit = result.toolName.replace(/^preview_/, 'commit_')
    if (toolNames.has(commit)) {
      return { toolChoice: { type: 'tool' as const, toolName: commit } }
    }
  }
  return undefined
}

/**
 * Pilote chaque étape de l'assistant. Un aperçu propre enchaîne sur son commit ; sinon la
 * dernière étape permise est réservée au texte : un tour coupé par la limite d'étapes doit
 * dire ce qui a été fait et ce qui reste, plutôt que s'arrêter sur un appel d'outil muet.
 * Hors de ces cas, seuls le socle et les groupes déjà chargés sont envoyés au modèle.
 */
export function prepareAssistantStep(
  steps: ReadonlyArray<AssistantStep>,
  toolNames: ReadonlySet<string>,
  maxSteps: number,
  history: readonly ModelMessage[] = []
) {
  // `toolChoice: 'none'` seul ne suffit pas : certains modèles appellent quand même un outil
  // et l'AI SDK lève `AI_ToolChoiceViolationError`. Sans outil exposé, il ne reste que le texte.
  const commit = commitAfterPreview(steps, toolNames)
  if (!commit && steps.length >= maxSteps - 1) {
    return { toolChoice: 'none' as const, activeTools: [] }
  }
  const activeTools = activeToolsFor(loadedGroups(history, steps), toolNames)
  return commit ? { ...commit, activeTools } : { activeTools }
}
