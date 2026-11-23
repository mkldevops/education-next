import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from '@modelcontextprotocol/ext-apps/server'
import { McpServer } from '@modelcontextprotocol/server'
import { appOrigin } from '@/lib/app-url'
import type { McpScope } from '@/use-cases/mcp/resolve-mcp-scope'
import { OVERDUE_VIEW_URI, overdueViewHtml } from './apps/overdue-view'
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
  const tools = listSchoolTools(scope)

  for (const tool of tools) {
    const config = {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      ...(tool.annotations ? { annotations: tool.annotations } : {}),
    }
    const handler = async (args: unknown) => call(tool.name, () => tool.run(args))
    if (tool.ui) {
      registerAppTool(
        server,
        tool.name,
        { ...config, _meta: { ui: { resourceUri: tool.ui } } },
        handler
      )
    } else {
      server.registerTool(tool.name, config, handler)
    }
  }

  if (tools.some((tool) => tool.ui === OVERDUE_VIEW_URI)) registerOverdueView(server)

  return server
}

/**
 * Vue HTML statique : aucune donnée d'école n'y figure, elle ne reçoit le résultat de
 * l'outil que par l'hôte. Seule l'origine publique y est inscrite, pour les liens.
 */
function registerOverdueView(server: McpServer) {
  registerAppResource(
    server,
    'Impayés',
    OVERDUE_VIEW_URI,
    { description: 'Familles en retard de paiement, triées par montant dû.' },
    async () => ({
      contents: [
        { uri: OVERDUE_VIEW_URI, mimeType: RESOURCE_MIME_TYPE, text: overdueViewHtml(appOrigin()) },
      ],
    })
  )
}
