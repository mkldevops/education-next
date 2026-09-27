import { McpServer } from '@modelcontextprotocol/server'
import type { McpScope } from '@/use-cases/mcp/resolve-mcp-scope'
import { listSchoolTools } from './school-tools'

const SERVER_INFO = { name: 'education', version: '1.0.0' }

function json(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] }
}

type ToolResult = ReturnType<typeof json> & { isError?: boolean }

async function guard(
  tool: string,
  run: () => Promise<unknown>,
  toResult: (value: unknown) => ToolResult
): Promise<ToolResult> {
  try {
    return toResult(await run())
  } catch (error) {
    console.error(`[mcp] ${tool}`, error)
    return { ...json({ error: 'internalError' }), isError: true }
  }
}

/**
 * Les use cases rendent leurs échecs attendus sous forme de chaîne typée ; seule cette
 * couche sait qu'une chaîne est un refus et non une valeur. Aucune projection lue ne se
 * réduit à une chaîne, donc lectures et écritures partagent la règle.
 */
function toToolResult(result: unknown): ToolResult {
  return typeof result === 'string' ? { ...json({ error: result }), isError: true } : json(result)
}

/**
 * Appel d'outil avec frontière d'erreur.
 *
 * Un jet inattendu — `TenantScopeError`, une erreur Prisma qui recopie la requête et les
 * colonnes, une erreur d'initialisation qui nomme l'hôte de la base — serait sérialisé
 * jusqu'au client, donc jusqu'au contexte du fournisseur de modèle. Le détail reste dans
 * les journaux du serveur, l'appelant ne reçoit qu'un refus fixe.
 */
function call(tool: string, run: () => Promise<unknown>) {
  return guard(tool, run, toToolResult)
}

/**
 * Instance MCP d'une requête, close sur la portée déjà résolue.
 *
 * Les outils viennent du catalogue partagé avec l'assistant intégré ; la clé fournit
 * l'école, jamais un argument d'outil.
 */
export function buildMcpServer(scope: McpScope): McpServer {
  const server = new McpServer(SERVER_INFO)

  for (const tool of listSchoolTools(scope)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
      },
      async (args: unknown) => call(tool.name, () => tool.run(args))
    )
  }

  return server
}
