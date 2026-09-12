import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { schoolGateway } from '@/gateways/school-gateway'
import { listClassPeriods } from '@/use-cases/class-periods/list-class-periods'
import { listLevels } from '@/use-cases/levels/list-levels'
import type { McpScope } from '@/use-cases/mcp/resolve-mcp-scope'
import { listPeriods } from '@/use-cases/periods/list-periods'
import { listPlans } from '@/use-cases/plans/list-plans'
import { listTeachers } from '@/use-cases/teachers/list-teachers'

const SERVER_INFO = { name: 'education', version: '1.0.0' }

const NO_ARGS = z.object({})

function json(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] }
}

/**
 * Instance MCP d'une requête, close sur la portée déjà résolue.
 *
 * Le `schoolId` vient de la clé, jamais d'un argument d'outil : un identifiant d'école
 * est exactement ce qu'un modèle de vision invente. Chaque use case le reçoit, et
 * l'isolation multi-écoles est alors celle du garde tenant, sans code dédié.
 */
export function buildMcpServer(scope: McpScope): McpServer {
  const server = new McpServer(SERVER_INFO)
  const { schoolId } = scope

  server.registerTool(
    'describe_school',
    {
      title: 'École courante',
      description:
        'École à laquelle la clé donne accès. Tout autre outil travaille dans cette école ' +
        "et il n'existe aucun moyen d'en viser une autre avec cette clé.",
      inputSchema: NO_ARGS,
    },
    async () => json(await schoolGateway.findActiveById(schoolId))
  )

  server.registerTool(
    'list_levels',
    {
      title: 'Niveaux',
      description: "Niveaux actifs de l'école, avec leur niveau suivant lorsqu'il est défini.",
      inputSchema: NO_ARGS,
    },
    async () => json(await listLevels(schoolId))
  )

  server.registerTool(
    'list_periods',
    {
      title: 'Périodes',
      description: 'Années ou périodes scolaires actives, de la plus récente à la plus ancienne.',
      inputSchema: NO_ARGS,
    },
    async () => json(await listPeriods(schoolId))
  )

  server.registerTool(
    'list_class_periods',
    {
      title: 'Classes',
      description:
        'Classes actives avec leur capacité, leur niveau et leur période. Un libellé lu sur ' +
        'une fiche papier se résout en identifiant de classe par cette liste.',
      inputSchema: NO_ARGS,
    },
    async () => json(await listClassPeriods(schoolId))
  )

  server.registerTool(
    'list_plans',
    {
      title: 'Formules tarifaires',
      description: 'Formules actives et leur montant, en centimes.',
      inputSchema: NO_ARGS,
    },
    async () => json(await listPlans(schoolId))
  )

  server.registerTool(
    'list_teachers',
    {
      title: 'Enseignants',
      description: "Enseignants actifs de l'école.",
      inputSchema: NO_ARGS,
    },
    async () => json(await listTeachers(schoolId))
  )

  return server
}
