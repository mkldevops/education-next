import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import {
  createClassScheduleSlotFromMcp,
  deleteClassScheduleSlotFromMcp,
  listClassScheduleSlotsFromMcp,
  updateClassScheduleSlotFromMcp,
} from '@/use-cases/mcp/class-schedule'
import { commitEnrollFamily } from '@/use-cases/mcp/commit-enroll-family'
import { commitRecordPayment } from '@/use-cases/mcp/commit-record-payment'
import { commitUpdateEnrollment } from '@/use-cases/mcp/commit-update-enrollment'
import { createEventFromMcp } from '@/use-cases/mcp/create-event'
import { previewEnrollFamily } from '@/use-cases/mcp/preview-enroll-family'
import { previewRecordPayment } from '@/use-cases/mcp/preview-record-payment'
import { previewUpdateEnrollment } from '@/use-cases/mcp/preview-update-enrollment'
import type { McpScope } from '@/use-cases/mcp/resolve-mcp-scope'
import {
  commitDraftSchema,
  mcpCreateClassScheduleSlotSchema,
  mcpCreateEventSchema,
  mcpDeleteClassScheduleSlotSchema,
  mcpListClassScheduleSlotsSchema,
  mcpUpdateClassScheduleSlotSchema,
  previewEnrollFamilySchema,
  previewRecordPaymentSchema,
  previewUpdateEnrollmentSchema,
} from '@/use-cases/mcp/schemas'

const SERVER_INFO = { name: 'education', version: '1.0.0' }

const NO_ARGS = z.object({})

// Pas `readOnlyHint` : un preview persiste son brouillon et `create_event` écrit sa ligne.
// Le dire évite qu'un client en approbation automatique fabrique des lignes sans jamais
// demander.
const NON_IDEMPOTENT_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
}

const IDEMPOTENT_COMMIT = { destructiveHint: false, idempotentHint: true, openWorldHint: false }
const DESTRUCTIVE_WRITE = { ...NON_IDEMPOTENT_WRITE, destructiveHint: true }

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
 * Lecture d'outil avec frontière d'erreur.
 *
 * Un jet inattendu — `TenantScopeError`, une erreur Prisma qui recopie la requête et les
 * colonnes, une erreur d'initialisation qui nomme l'hôte de la base — serait sérialisé
 * jusqu'au client, donc jusqu'au contexte du fournisseur de modèle. Le détail reste dans
 * les journaux du serveur, l'appelant ne reçoit qu'un refus fixe.
 */
function read(tool: string, load: () => Promise<unknown>) {
  return guard(tool, load, json)
}

/**
 * Écriture d'outil, même frontière d'erreur que `read()`.
 *
 * Les use cases d'écriture rendent leurs échecs attendus sous forme de chaîne typée ;
 * seule cette couche sait qu'une chaîne est un refus et non une valeur. Le `catch`
 * couvre le reste, pour la raison écrite au-dessus.
 */
function write(tool: string, run: () => Promise<unknown>) {
  return guard(tool, run, (result) =>
    typeof result === 'string' ? { ...json({ error: result }), isError: true } : json(result)
  )
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
    async () => read('describe_school', () => mcpReadGateway.describeSchool(schoolId))
  )

  server.registerTool(
    'list_levels',
    {
      title: 'Niveaux',
      description: "Niveaux actifs de l'école, avec leur niveau suivant lorsqu'il est défini.",
      inputSchema: NO_ARGS,
    },
    async () => read('list_levels', () => mcpReadGateway.listLevels(schoolId))
  )

  server.registerTool(
    'list_periods',
    {
      title: 'Périodes',
      description: 'Années ou périodes scolaires actives, de la plus récente à la plus ancienne.',
      inputSchema: NO_ARGS,
    },
    async () => read('list_periods', () => mcpReadGateway.listPeriods(schoolId))
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
    async () => read('list_class_periods', () => mcpReadGateway.listClassPeriods(schoolId))
  )

  server.registerTool(
    'list_class_schedule_slots',
    {
      title: 'Créneaux du planning',
      description:
        "Liste les créneaux hebdomadaires d'une période de l'école de la clé. " +
        'Prendre `periodId` dans `list_periods`. `weekday` vaut 1 pour lundi et 7 pour dimanche. ' +
        'Refus `notConfigured` si le planning est désactivé.',
      inputSchema: mcpListClassScheduleSlotsSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) =>
      write('list_class_schedule_slots', () => listClassScheduleSlotsFromMcp(scope, args))
  )

  server.registerTool(
    'create_class_schedule_slot',
    {
      title: 'Créer un créneau hebdomadaire',
      description:
        "Ajoute un créneau récurrent à une classe de l'école de la clé. Prendre `classPeriodId` " +
        'dans `list_class_periods`; `weekday` vaut 1 pour lundi et 7 pour dimanche; heures ' +
        '`HH:mm`, avec fin exclue. `teacherIds` contient seulement des enseignants déjà affectés ' +
        'à cette classe, ou `[]`. Rend `id` et les avertissements de chevauchement enseignant. ' +
        'Refus : `notConfigured`, `classPeriodNotFound`, `teacherNotFound`, `invalidTimeRange`, ' +
        '`classOverlap`, `teacherOverlap`, `validationError`.',
      inputSchema: mcpCreateClassScheduleSlotSchema,
      annotations: NON_IDEMPOTENT_WRITE,
    },
    async (args) =>
      write('create_class_schedule_slot', () => createClassScheduleSlotFromMcp(scope, args))
  )

  server.registerTool(
    'update_class_schedule_slot',
    {
      title: 'Modifier un créneau hebdomadaire',
      description:
        "Remplace les données d'un créneau de l'école de la clé. `id` vient de " +
        '`list_class_schedule_slots`; fournir tous les champs modifiables, y compris `teacherIds`. ' +
        'La classe du créneau ne change pas. ' +
        'Même validation que la création, plus `notFound`.',
      inputSchema: mcpUpdateClassScheduleSlotSchema,
      annotations: NON_IDEMPOTENT_WRITE,
    },
    async (args) =>
      write('update_class_schedule_slot', () => updateClassScheduleSlotFromMcp(scope, args))
  )

  server.registerTool(
    'delete_class_schedule_slot',
    {
      title: 'Supprimer un créneau hebdomadaire',
      description:
        "Supprime un créneau de l'école de la clé par son `id`. Cette opération peut changer " +
        'les présences attendues. Refus : `notConfigured`, `notFound`, `validationError`.',
      inputSchema: mcpDeleteClassScheduleSlotSchema,
      annotations: DESTRUCTIVE_WRITE,
    },
    async (args) =>
      write('delete_class_schedule_slot', () => deleteClassScheduleSlotFromMcp(scope, args))
  )

  if (scope.paymentsEnabled) {
    server.registerTool(
      'list_plans',
      {
        title: 'Formules tarifaires',
        description:
          'Formules actives et leur montant. Le montant est une valeur décimale rendue en ' +
          "chaîne, dans la devise de l'école — jamais des centimes.",
        inputSchema: NO_ARGS,
      },
      async () => read('list_plans', () => mcpReadGateway.listPlans(schoolId))
    )
  }

  server.registerTool(
    'list_teachers',
    {
      title: 'Enseignants',
      description: "Enseignants actifs de l'école.",
      inputSchema: NO_ARGS,
    },
    async () => read('list_teachers', () => mcpReadGateway.listTeachers(schoolId))
  )

  server.registerTool(
    'preview_enroll_family',
    {
      title: 'Préparer une inscription de famille',
      description:
        "Résout une fiche d'inscription en plan écrit, sans rien créer. Classe et formule " +
        "sont attendues en libellés, par élève ; sans formule, l'élève prend celle de la " +
        'famille. `familyId` à la place de `familyName` rattache les élèves à une famille ' +
        'existante : un élève déjà membre reçoit son inscription sans être recréé. Rend un ' +
        '`draftId`, un `checksum`, le plan résolu, les ' +
        'homonymes trouvés, des avertissements et des `blockers`. Un `blockers` non vide ' +
        'nomme le champ à corriger et interdit le commit.',
      inputSchema: previewEnrollFamilySchema,
      annotations: NON_IDEMPOTENT_WRITE,
    },
    async (args) => write('preview_enroll_family', () => previewEnrollFamily(scope, args))
  )

  server.registerTool(
    'commit_enroll_family',
    {
      title: 'Engager une inscription de famille',
      description:
        "Crée la famille (ou reprend celle visée), ses parents, ses élèves, leurs inscriptions et l'encaissement du " +
        'plan déjà prévisualisé. Rejouer le même `draftId` rend le résultat enregistré au ' +
        "lieu de créer une seconde famille. Le brouillon expire au bout d'une demi-heure.",
      inputSchema: commitDraftSchema,
      annotations: IDEMPOTENT_COMMIT,
    },
    async (args) => write('commit_enroll_family', () => commitEnrollFamily(scope, args))
  )

  // Déclaré même quand `events_enabled` est éteint, à l'inverse des outils d'argent : le
  // refus `notConfigured` de `createEvent` est ici le contrat, identique à celui de l'action
  // serveur, et lire le drapeau ici rendrait la construction du serveur asynchrone.
  server.registerTool(
    'create_event',
    {
      title: 'Créer un événement',
      description:
        "Crée un événement de l'école, toujours en brouillon : la publication se fait depuis " +
        'le tableau de bord. `startAt` et `endAt` sont un jour (`2026-12-03`) ou une heure ' +
        'murale sans fuseau (`2026-12-03T18:00`) — jamais de décalage. Sans `allDay`, un jour ' +
        'seul vaut journée entière. Refus typés : `notConfigured` (événements désactivés dans ' +
        "l'école), `slugTaken` (un événement actif porte déjà ce titre : le renommer, par " +
        "exemple avec l'année), `invalidDateRange`, `validationError`.",
      inputSchema: mcpCreateEventSchema,
      annotations: NON_IDEMPOTENT_WRITE,
    },
    async (args) => write('create_event', () => createEventFromMcp(scope, args))
  )

  // Les cinq outils d'argent ci-dessous ne se déclarent pas quand l'école a coupé les
  // paiements : un outil absent ne trompe pas l'agent, alors qu'un outil déclaré qui
  // refuserait systématiquement l'inviterait à insister ou à mal lire le refus. C'est le
  // mécanisme premier ; les use cases eux-mêmes refusent aussi, en défense en profondeur.
  if (scope.paymentsEnabled) {
    server.registerTool(
      'preview_record_payment',
      {
        title: 'Préparer un encaissement',
        description:
          'Résout la famille, ventile le montant sur ses inscriptions actives et rend la ' +
          'répartition sans rien écrire. La famille se désigne par son identifiant ou par ' +
          'son nom ; un nom qui vise plusieurs familles est un `blocker`.',
        inputSchema: previewRecordPaymentSchema,
        annotations: NON_IDEMPOTENT_WRITE,
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
        annotations: IDEMPOTENT_COMMIT,
      },
      async (args) => write('commit_record_payment', () => commitRecordPayment(scope, args))
    )

    server.registerTool(
      'preview_update_enrollment',
      {
        title: "Préparer la modification d'une inscription",
        description:
          "Change la formule et/ou la remise d'une inscription en attente ou active, sans rien " +
          "écrire. L'inscription se désigne par son identifiant, ou par le prénom et le nom de " +
          "l'élève ; la formule est attendue en libellé. Sans remise, l'inscription garde la " +
          'sienne. Rend le passage « avant → après », le total recalculé et le reste à payer ; ' +
          'plusieurs inscriptions candidates sont un `blocker` qui les liste.',
        inputSchema: previewUpdateEnrollmentSchema,
        annotations: NON_IDEMPOTENT_WRITE,
      },
      async (args) => write('preview_update_enrollment', () => previewUpdateEnrollment(scope, args))
    )

    server.registerTool(
      'commit_update_enrollment',
      {
        title: "Engager la modification d'une inscription",
        description:
          'Applique la formule, la remise et le total déjà prévisualisés. Les paiements ' +
          "restent sur l'inscription. Rejouer le même `draftId` rend le résultat enregistré.",
        inputSchema: commitDraftSchema,
        annotations: IDEMPOTENT_COMMIT,
      },
      async (args) => write('commit_update_enrollment', () => commitUpdateEnrollment(scope, args))
    )
  }

  return server
}
