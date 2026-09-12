import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { schoolGateway } from '@/gateways/school-gateway'
import { listClassPeriods } from '@/use-cases/class-periods/list-class-periods'
import { listLevels } from '@/use-cases/levels/list-levels'
import { commitEnrollFamily } from '@/use-cases/mcp/commit-enroll-family'
import { commitRecordPayment } from '@/use-cases/mcp/commit-record-payment'
import { previewEnrollFamily } from '@/use-cases/mcp/preview-enroll-family'
import { previewRecordPayment } from '@/use-cases/mcp/preview-record-payment'
import type { McpScope } from '@/use-cases/mcp/resolve-mcp-scope'
import {
  commitDraftSchema,
  previewEnrollFamilySchema,
  previewRecordPaymentSchema,
} from '@/use-cases/mcp/schemas'
import { listPeriods } from '@/use-cases/periods/list-periods'
import { listPlans } from '@/use-cases/plans/list-plans'
import { listTeachers } from '@/use-cases/teachers/list-teachers'

const SERVER_INFO = { name: 'education', version: '1.0.0' }

const NO_ARGS = z.object({})

function json(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] }
}

/**
 * Lecture d'outil avec frontière d'erreur.
 *
 * Un jet inattendu — `TenantScopeError`, une erreur Prisma qui recopie la requête et les
 * colonnes, une erreur d'initialisation qui nomme l'hôte de la base — serait sérialisé
 * jusqu'au client, donc jusqu'au contexte du fournisseur de modèle. Le détail reste dans
 * les journaux du serveur, l'appelant ne reçoit qu'un refus fixe.
 */
async function read(tool: string, load: () => Promise<unknown>) {
  try {
    return json(await load())
  } catch (error) {
    console.error(`[mcp] ${tool}`, error)
    return { ...json({ error: 'internalError' }), isError: true }
  }
}

/**
 * Écriture d'outil, même frontière d'erreur que `read()`.
 *
 * Les use cases d'écriture rendent leurs échecs attendus sous forme de chaîne typée ;
 * seule cette couche sait qu'une chaîne est un refus et non une valeur. Le `catch`
 * couvre le reste, pour la raison écrite au-dessus.
 */
async function write(tool: string, run: () => Promise<unknown>) {
  try {
    const result = await run()
    if (typeof result === 'string') return { ...json({ error: result }), isError: true }
    return json(result)
  } catch (error) {
    console.error(`[mcp] ${tool}`, error)
    return { ...json({ error: 'internalError' }), isError: true }
  }
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
    async () => read('describe_school', () => schoolGateway.findActiveById(schoolId))
  )

  server.registerTool(
    'list_levels',
    {
      title: 'Niveaux',
      description: "Niveaux actifs de l'école, avec leur niveau suivant lorsqu'il est défini.",
      inputSchema: NO_ARGS,
    },
    async () => read('list_levels', () => listLevels(schoolId))
  )

  server.registerTool(
    'list_periods',
    {
      title: 'Périodes',
      description: 'Années ou périodes scolaires actives, de la plus récente à la plus ancienne.',
      inputSchema: NO_ARGS,
    },
    async () => read('list_periods', () => listPeriods(schoolId))
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
    async () => read('list_class_periods', () => listClassPeriods(schoolId))
  )

  server.registerTool(
    'list_plans',
    {
      title: 'Formules tarifaires',
      description: 'Formules actives et leur montant, en centimes.',
      inputSchema: NO_ARGS,
    },
    async () => read('list_plans', () => listPlans(schoolId))
  )

  server.registerTool(
    'list_teachers',
    {
      title: 'Enseignants',
      description: "Enseignants actifs de l'école.",
      inputSchema: NO_ARGS,
    },
    async () => read('list_teachers', () => listTeachers(schoolId))
  )

  server.registerTool(
    'preview_enroll_family',
    {
      title: 'Préparer une inscription de famille',
      description:
        "Résout une fiche d'inscription en plan écrit, sans rien créer. Classe et formule " +
        'sont attendues en libellés. Rend un `draftId`, un `checksum`, le plan résolu, les ' +
        'homonymes trouvés, des avertissements et des `blockers`. Un `blockers` non vide ' +
        'nomme le champ à corriger et interdit le commit.',
      inputSchema: previewEnrollFamilySchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => write('preview_enroll_family', () => previewEnrollFamily(scope, args))
  )

  server.registerTool(
    'commit_enroll_family',
    {
      title: 'Engager une inscription de famille',
      description:
        "Crée la famille, ses parents, ses élèves, leurs inscriptions et l'encaissement du " +
        'plan déjà prévisualisé. Rejouer le même `draftId` rend le résultat enregistré au ' +
        "lieu de créer une seconde famille. Le brouillon expire au bout d'une demi-heure.",
      inputSchema: commitDraftSchema,
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => write('commit_enroll_family', () => commitEnrollFamily(scope, args))
  )

  server.registerTool(
    'preview_record_payment',
    {
      title: 'Préparer un encaissement',
      description:
        'Résout la famille, ventile le montant sur ses inscriptions actives et rend la ' +
        'répartition sans rien écrire. La famille se désigne par son identifiant ou par ' +
        'son nom ; un nom qui vise plusieurs familles est un `blocker`.',
      inputSchema: previewRecordPaymentSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => write('preview_record_payment', () => previewRecordPayment(scope, args))
  )

  server.registerTool(
    'commit_record_payment',
    {
      title: 'Engager un encaissement',
      description:
        'Écrit les paiements de la répartition déjà prévisualisée. Rejouer le même ' +
        '`draftId` rend le résultat enregistré au lieu de doubler le versement.',
      inputSchema: commitDraftSchema,
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => write('commit_record_payment', () => commitRecordPayment(scope, args))
  )

  return server
}
