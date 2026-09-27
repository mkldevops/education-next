import { createHash } from 'node:crypto'
import { type ToolApprovalStatus, type ToolSet, tool } from 'ai'
import { listSchoolTools, type SchoolTool } from '@/mcp/school-tools'
import type { DraftScope } from '@/use-cases/mcp/draft-scope'

/**
 * Secret de signature des approbations, dérivé de celui de Better Auth pour ne pas ajouter
 * une variable d'environnement. Le client renvoie tout l'historique à chaque tour : sans
 * signature, il pourrait forger l'approbation d'une écriture qu'aucun humain n'a validée.
 */
export function toolApprovalSecret(
  authSecret: string | undefined = process.env.BETTER_AUTH_SECRET
): string | null {
  const secret = authSecret?.trim()
  if (!secret) return null
  return createHash('sha256').update(`ai-tool-approval:${secret}`).digest('base64')
}

/**
 * Même contrat de sortie que le MCP : un refus typé devient `{ error }`, un jet inattendu
 * un refus fixe dont le détail reste dans le journal du serveur.
 */
async function runForModel(schoolTool: SchoolTool, args: unknown) {
  try {
    const result = await schoolTool.run(args)
    return typeof result === 'string' ? { error: result } : result
  } catch (error) {
    console.error(`[api/ai/assistant] ${schoolTool.name}`, error)
    return { error: 'internalError' }
  }
}

/**
 * Traduit le catalogue partagé avec le MCP en outils de l'AI SDK.
 *
 * Chaque écriture attend la validation explicite de l'administrateur ; sans secret de
 * signature, elle est refusée d'office plutôt que validée sur la foi du client.
 */
export function buildAssistantTools(scope: DraftScope, approvalSecret: string | null) {
  const catalog = listSchoolTools(scope)
  const tools: ToolSet = {}
  const toolApproval: Record<string, ToolApprovalStatus> = {}

  for (const schoolTool of catalog) {
    tools[schoolTool.name] = tool({
      title: schoolTool.title,
      description: schoolTool.description,
      inputSchema: schoolTool.inputSchema,
      execute: (args: unknown) => runForModel(schoolTool, args),
    })
    if (schoolTool.kind === 'write') {
      toolApproval[schoolTool.name] = approvalSecret
        ? 'user-approval'
        : { type: 'denied', reason: 'approvalUnavailable' }
    }
  }

  return { tools, toolApproval, toolNames: new Set(Object.keys(tools)) }
}
