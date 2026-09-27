type StepToolResult = { toolName: string; output: unknown }

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
