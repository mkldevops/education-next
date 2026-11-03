import { z } from 'zod'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { assignTeacherFromMcp } from '@/use-cases/mcp/assign-teacher'
import { cancelPaymentsFromMcp } from '@/use-cases/mcp/cancel-payments'
import {
  createClassScheduleSlotFromMcp,
  deleteClassScheduleSlotFromMcp,
  listClassScheduleSlotsFromMcp,
  updateClassScheduleSlotFromMcp,
} from '@/use-cases/mcp/class-schedule'
import { commitClassSchedule } from '@/use-cases/mcp/commit-class-schedule'
import { commitEnrollFamily } from '@/use-cases/mcp/commit-enroll-family'
import { commitMergeFamilies } from '@/use-cases/mcp/commit-merge-families'
import { commitRecordPayment } from '@/use-cases/mcp/commit-record-payment'
import { commitRecordTeacherExpense } from '@/use-cases/mcp/commit-record-teacher-expense'
import { commitUpdateEnrollment } from '@/use-cases/mcp/commit-update-enrollment'
import { createClassPeriodFromMcp } from '@/use-cases/mcp/create-class-period'
import { createEventFromMcp } from '@/use-cases/mcp/create-event'
import { createLevelFromMcp } from '@/use-cases/mcp/create-level'
import { createTeacherFromMcp } from '@/use-cases/mcp/create-teacher'
import {
  archiveClassPeriodFromMcp,
  archiveLevelFromMcp,
  archivePlanFromMcp,
  archiveStudentFromMcp,
  deleteFamilyFromMcp,
  getFamilyDeletionImpactFromMcp,
} from '@/use-cases/mcp/delete-resources'
import type { DraftScope } from '@/use-cases/mcp/draft-scope'
import { duplicateEventFromMcp } from '@/use-cases/mcp/duplicate-event'
import { familyPaymentsFromMcp } from '@/use-cases/mcp/family-payments'
import { findStudentsFromMcp } from '@/use-cases/mcp/find-students'
import { getEventFromMcp } from '@/use-cases/mcp/get-event'
import { listAttendanceCallsFromMcp } from '@/use-cases/mcp/list-attendance-calls'
import { listEventsFromMcp } from '@/use-cases/mcp/list-events'
import { createPlanFromMcp, updatePlanFromMcp } from '@/use-cases/mcp/plan-configuration'
import { previewClassSchedule } from '@/use-cases/mcp/preview-class-schedule'
import { previewEnrollFamily } from '@/use-cases/mcp/preview-enroll-family'
import { previewMergeFamilies } from '@/use-cases/mcp/preview-merge-families'
import { previewRecordPayment } from '@/use-cases/mcp/preview-record-payment'
import { previewRecordTeacherExpense } from '@/use-cases/mcp/preview-record-teacher-expense'
import { previewUpdateEnrollment } from '@/use-cases/mcp/preview-update-enrollment'
import {
  commitDraftSchema,
  MCP_ATTENDANCE_RANGE_MAX_DAYS,
  MCP_CLASS_SCHEDULE_BATCH_MAX,
  MCP_EVENT_LIST_DEFAULT,
  MCP_EVENT_LIST_MAX,
  MCP_STUDENT_SEARCH_MAX,
  mcpAssignTeacherSchema,
  mcpCancelPaymentsSchema,
  mcpCreateClassPeriodSchema,
  mcpCreateClassScheduleSlotSchema,
  mcpCreateEventSchema,
  mcpCreateLevelSchema,
  mcpCreatePlanSchema,
  mcpCreateTeacherSchema,
  mcpDeleteClassScheduleSlotSchema,
  mcpDeleteFamilySchema,
  mcpDuplicateEventSchema,
  mcpEventIdSchema,
  mcpFamilyPaymentsSchema,
  mcpFindStudentsSchema,
  mcpListAttendanceCallsSchema,
  mcpListClassScheduleSlotsSchema,
  mcpListEventsSchema,
  mcpResourceIdSchema,
  mcpUpdateClassScheduleSlotSchema,
  mcpUpdateEventSchema,
  mcpUpdatePlanSchema,
  previewClassScheduleSchema,
  previewEnrollFamilySchema,
  previewMergeFamiliesSchema,
  previewRecordPaymentSchema,
  previewRecordTeacherExpenseSchema,
  previewUpdateEnrollmentSchema,
} from '@/use-cases/mcp/schemas'
import { updateEventFromMcp } from '@/use-cases/mcp/update-event'
import { listMealTools } from './meal-tools'

const NO_ARGS = z.object({})

type ToolAnnotations = {
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

// Pas `readOnlyHint` : un preview persiste son brouillon, `create_event` et `duplicate_event`
// écrivent leur ligne.
// Le dire évite qu'un client en approbation automatique fabrique des lignes sans jamais
// demander.
const NON_IDEMPOTENT_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
}

const IDEMPOTENT_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

const IDEMPOTENT_COMMIT = { destructiveHint: false, idempotentHint: true, openWorldHint: false }
const DESTRUCTIVE_WRITE = { ...NON_IDEMPOTENT_WRITE, destructiveHint: true }

// Réécrit des champs saisis par un humain : un client en approbation automatique doit
// demander avant, même si rejouer les mêmes arguments ne change plus rien.
const IDEMPOTENT_OVERWRITE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
}

/**
 * `read` ne touche à rien, `draft` persiste un brouillon sans effet métier, `write` modifie
 * les données de l'école. L'assistant intégré fait valider chaque `write` par l'humain ; le
 * MCP laisse cette décision au client, guidé par les annotations.
 */
type SchoolToolKind = 'read' | 'draft' | 'write'

export type SchoolTool = {
  name: string
  title: string
  description: string
  inputSchema: z.ZodObject
  annotations?: ToolAnnotations
  kind: SchoolToolKind
  run: (args: unknown) => Promise<unknown>
}

/**
 * Le SDK MCP comme l'AI SDK valident les arguments contre `inputSchema` avant d'appeler
 * `run` ; le transtypage ne fait que rendre ce contrat visible au compilateur.
 */
function define<S extends z.ZodObject>(
  tool: Omit<SchoolTool, 'inputSchema' | 'run'> & {
    inputSchema: S
    run: (args: z.infer<S>) => Promise<unknown>
  }
): SchoolTool {
  return { ...tool, run: (args) => tool.run(args as z.infer<S>) }
}

/**
 * Catalogue unique des outils d'une école, partagé par le serveur MCP et l'assistant
 * intégré : ce que l'un sait faire, l'autre le sait aussi.
 *
 * Le `schoolId` vient de la portée — clé MCP ou session d'administrateur — jamais d'un
 * argument d'outil : un identifiant d'école est exactement ce qu'un modèle de vision
 * invente. Chaque use case le reçoit, et l'isolation multi-écoles est alors celle du garde
 * tenant, sans code dédié.
 */
export function listSchoolTools(scope: DraftScope): SchoolTool[] {
  const { schoolId } = scope

  const tools: SchoolTool[] = [
    ...listMealTools(scope),
    define({
      name: 'describe_school',
      title: 'École courante',
      description:
        "École à laquelle l'appelant a accès. Tout autre outil travaille dans cette école " +
        "et il n'existe aucun moyen d'en viser une autre.",
      inputSchema: NO_ARGS,
      kind: 'read',
      run: () => mcpReadGateway.describeSchool(schoolId),
    }),
    define({
      name: 'list_levels',
      title: 'Niveaux',
      description:
        "Niveaux actifs de l'école, avec leurs niveaux suivants (aucun en fin de progression, " +
        'plusieurs quand la progression se divise).',
      inputSchema: NO_ARGS,
      kind: 'read',
      run: () => mcpReadGateway.listLevels(schoolId),
    }),
    define({
      name: 'create_level',
      title: 'Créer un niveau',
      description:
        "Crée un niveau dans l'école courante, sans classe ni progression. " +
        'Prendre son identifiant dans le résultat pour créer ensuite une classe. ' +
        'Refus : `nameTaken` (niveau actif de même nom), `validationError`. ' +
        'Consulter `list_levels` avant de créer pour éviter les doublons.',
      inputSchema: mcpCreateLevelSchema,
      annotations: NON_IDEMPOTENT_WRITE,
      kind: 'write',
      run: (args) => createLevelFromMcp(scope, args),
    }),
    define({
      name: 'list_periods',
      title: 'Périodes',
      description: 'Années ou périodes scolaires actives, de la plus récente à la plus ancienne.',
      inputSchema: NO_ARGS,
      kind: 'read',
      run: () => mcpReadGateway.listPeriods(schoolId),
    }),
    define({
      name: 'list_class_periods',
      title: 'Classes',
      description:
        'Classes actives avec leur capacité, leur niveau et leur période. Un libellé lu sur ' +
        'une fiche papier se résout en identifiant de classe par cette liste.',
      inputSchema: NO_ARGS,
      kind: 'read',
      run: () => mcpReadGateway.listClassPeriods(schoolId),
    }),
    define({
      name: 'create_class_period',
      title: 'Créer une classe',
      description:
        "Crée une classe dans l'école courante, avec son nom et une capacité entière positive. " +
        'Prendre `levelId` dans `list_levels` et `periodId` dans `list_periods`. ' +
        '`teacherIds` est facultatif et contient des identifiants de `list_teachers`. ' +
        'Un niveau ne peut avoir qu’une classe par période. Refus : `levelNotFound`, ' +
        '`periodNotFound`, `levelAlreadyAssigned`, `teacherNotFound`, `validationError`. ' +
        'Consulter `list_class_periods` avant de créer pour éviter les doublons.',
      inputSchema: mcpCreateClassPeriodSchema,
      annotations: NON_IDEMPOTENT_WRITE,
      kind: 'write',
      run: (args) => createClassPeriodFromMcp(scope, args),
    }),
    define({
      name: 'list_class_schedule_slots',
      title: 'Créneaux du planning',
      description:
        "Liste les créneaux hebdomadaires d'une période de l'école. " +
        'Prendre `periodId` dans `list_periods`. `weekday` vaut 1 pour lundi et 7 pour dimanche. ' +
        'Refus `notConfigured` si le planning est désactivé.',
      inputSchema: mcpListClassScheduleSlotsSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      kind: 'read',
      run: (args) => listClassScheduleSlotsFromMcp(scope, args),
    }),
    define({
      name: 'create_class_schedule_slot',
      title: 'Créer un créneau hebdomadaire',
      description:
        "Ajoute un créneau récurrent à une classe de l'école. Prendre `classPeriodId` " +
        'dans `list_class_periods`; `weekday` vaut 1 pour lundi et 7 pour dimanche; heures ' +
        '`HH:mm`, avec fin exclue. `teacherIds` contient seulement des enseignants déjà affectés ' +
        'à cette classe, ou `[]`. Rend `id` et les avertissements de chevauchement enseignant. ' +
        'Refus : `notConfigured`, `classPeriodNotFound`, `teacherNotFound`, `invalidTimeRange`, ' +
        '`classOverlap`, `teacherOverlap`, `validationError`.',
      inputSchema: mcpCreateClassScheduleSlotSchema,
      annotations: NON_IDEMPOTENT_WRITE,
      kind: 'write',
      run: (args) => createClassScheduleSlotFromMcp(scope, args),
    }),
    define({
      name: 'update_class_schedule_slot',
      title: 'Modifier un créneau hebdomadaire',
      description:
        "Remplace les données d'un créneau de l'école. `id` vient de " +
        '`list_class_schedule_slots`; fournir tous les champs modifiables, y compris `teacherIds`. ' +
        'La classe du créneau ne change pas. ' +
        'Même validation que la création, plus `notFound`.',
      inputSchema: mcpUpdateClassScheduleSlotSchema,
      annotations: NON_IDEMPOTENT_WRITE,
      kind: 'write',
      run: (args) => updateClassScheduleSlotFromMcp(scope, args),
    }),
    define({
      name: 'delete_class_schedule_slot',
      title: 'Supprimer un créneau hebdomadaire',
      description:
        "Supprime un créneau de l'école par son `id`. Cette opération peut changer " +
        'les présences attendues. Refus : `notConfigured`, `notFound`, `validationError`.',
      inputSchema: mcpDeleteClassScheduleSlotSchema,
      annotations: DESTRUCTIVE_WRITE,
      kind: 'write',
      run: (args) => deleteClassScheduleSlotFromMcp(scope, args),
    }),
    define({
      name: 'preview_class_schedule',
      title: 'Préparer un planning complet',
      description:
        "Résout un planning hebdomadaire entier — le samedi et le dimanche d'une année, par " +
        'exemple — sans rien écrire. `periodId` vient de `list_periods` ; chaque ligne de `slots` ' +
        'porte la classe et les enseignants en libellés, `weekday` (1 lundi … 7 dimanche), des ' +
        `heures \`HH:mm\` à fin exclue et une description facultative — ${MCP_CLASS_SCHEDULE_BATCH_MAX} ` +
        'lignes au plus. Rend un `draftId`, un ' +
        '`checksum`, le plan résolu, les candidats des libellés ambigus, les créneaux existants ' +
        'en conflit, des avertissements et des `blockers` nommant la ligne à corriger ' +
        '(`slots.3.className`). Refus : `notConfigured`, `validationError`.',
      inputSchema: previewClassScheduleSchema,
      annotations: NON_IDEMPOTENT_WRITE,
      kind: 'draft',
      run: (args) => previewClassSchedule(scope, args),
    }),
    define({
      name: 'commit_class_schedule',
      title: 'Engager un planning complet',
      description:
        'Crée tous les créneaux du plan déjà prévisualisé dans une seule transaction : un seul ' +
        "créneau refusé (`classOverlap`, `teacherOverlap`, `notFound`, `teacherNotFound`) et rien n'est " +
        'écrit. Rejouer le même `draftId` rend le résultat enregistré au lieu de doubler le ' +
        "planning. Le brouillon expire au bout d'une demi-heure.",
      inputSchema: commitDraftSchema,
      annotations: IDEMPOTENT_COMMIT,
      kind: 'write',
      run: (args) => commitClassSchedule(scope, args),
    }),
    // Lecture seule : ouvrir, saisir, valider ou annuler un appel reste une action du
    // tableau de bord.
    define({
      name: 'list_attendance_calls',
      title: 'Suivi des appels',
      description:
        "Appels de l'école jour par jour, comme la page de suivi des appels : créneaux " +
        'attendus (`NOT_STARTED`, `IN_PROGRESS`, `VALIDATED`), appels exceptionnels ' +
        '(`slotId` nul) et appels annulés (`CANCELLED`). Si attendance_frequency=DAILY, ' +
        'un seul appel est attendu par classe/jour (slotId et heures nuls), même avec plusieurs cours ; ' +
        'les appels historiques restent visibles. `periodId` vient de `list_periods`, ' +
        '`classPeriodId` facultatif de `list_class_periods` ; `from` et `to` sont des jours ' +
        `inclus (\`2026-09-26\`), \`to\` vaut \`from\` par défaut, ${MCP_ATTENDANCE_RANGE_MAX_DAYS} ` +
        'jours au plus. Un jour de fermeture (`closed`) ne garde que les appels déjà ouverts. ' +
        "Aucun élève ni présence n'est publié. Refus : `notConfigured`, `notFound` (période), " +
        '`invalidDateRange`, `rangeTooLong`, `validationError`.',
      inputSchema: mcpListAttendanceCallsSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      kind: 'read',
      run: (args) => listAttendanceCallsFromMcp(scope, args),
    }),
  ]

  if (scope.paymentsEnabled) {
    tools.push(
      define({
        name: 'list_plans',
        title: 'Formules tarifaires',
        description:
          'Formules actives : montant annuel, base de prix `pricing` (annuelle ou mensualité × mois) ' +
          'et suivi `paymentSchedule` (NONE, MONTHLY, QUARTERLY ou INSTALLMENTS). ' +
          "`amount` est une chaîne décimale, dans la devise de l'école — jamais des centimes.",
        inputSchema: NO_ARGS,
        kind: 'read',
        run: () => mcpReadGateway.listPlans(schoolId),
      }),
      define({
        name: 'create_plan',
        title: 'Créer une formule tarifaire',
        description:
          'Crée une formule dans l’école courante. Fournir `pricing` : ANNUAL avec son montant, ' +
          'ou MONTHLY avec le montant mensuel et `months` ; le total annuel est calculé. ' +
          '`amount` accepte aussi directement un total annuel. `paymentSchedule` choisit NONE ' +
          '(aucun retard calculé), MONTHLY (1–12 échéances), QUARTERLY (1–4 échéances), ' +
          'ou INSTALLMENTS (1–5 dates mois/jour). Pour les modes récurrents : `firstMonth` ' +
          '(1–12), `count` et `dueDay` (1–31). Les dates sont relatives à la période scolaire. ' +
          'Le prix et le suivi sont indépendants ; ce suivi ne limite pas le nombre de paiements ' +
          'enregistrables. Consulter `list_plans` avant de créer. Refus : `validationError`, ' +
          '`paymentsDisabled`, `unpricedPlan`.',
        inputSchema: mcpCreatePlanSchema,
        annotations: NON_IDEMPOTENT_WRITE,
        kind: 'write',
        run: (args) => createPlanFromMcp(scope, args),
      }),
      define({
        name: 'update_plan',
        title: 'Modifier le prix ou le suivi d’une formule',
        description:
          'Modifie les champs fournis d’une formule de `list_plans`. Même saisie du prix et du ' +
          'suivi que `create_plan`. Un changement de prix ne modifie pas les totaux des inscriptions ' +
          'existantes ; un changement de suivi s’applique à leurs prochains calculs de retard. ' +
          'Pour désactiver le suivi : `paymentSchedule: {mode: "NONE"}`. ' +
          'Refus : `notFound`, `validationError`, `paymentsDisabled`, `unpricedPlan`.',
        inputSchema: mcpUpdatePlanSchema,
        annotations: IDEMPOTENT_OVERWRITE,
        kind: 'write',
        run: (args) => updatePlanFromMcp(scope, args),
      })
    )
  }

  tools.push(
    define({
      name: 'list_teachers',
      title: 'Enseignants',
      description: "Enseignants actifs de l'école.",
      inputSchema: NO_ARGS,
      kind: 'read',
      run: () => mcpReadGateway.listTeachers(schoolId),
    }),
    define({
      name: 'create_teacher',
      title: 'Créer un enseignant',
      description:
        "Crée un enseignant dans l'école, sans classe ni période : seul le prénom est requis, " +
        "le nom est facultatif. L'affecter à une classe est une autre opération. Un enseignant actif " +
        "du même nom, dans un ordre ou l'autre, ou de la même adresse suspend la création : " +
        'la réponse `{ created: false, reason: "possibleDuplicate", matches }` liste les ' +
        "fiches trouvées. `allowDuplicate: true` crée quand même, sur décision de l'humain. " +
        'Rend `id`, `firstName`, `lastName`.',
      inputSchema: mcpCreateTeacherSchema,
      annotations: NON_IDEMPOTENT_WRITE,
      kind: 'write',
      run: (args) => createTeacherFromMcp(scope, args),
    }),
    define({
      name: 'assign_teacher_to_class',
      title: 'Affecter un enseignant à une classe',
      description:
        "Ajoute un enseignant actif aux enseignants d'une classe de l'école, sans retirer ceux " +
        'déjà affectés. `classPeriodId` vient de `list_class_periods`, `teacherId` de ' +
        '`list_teachers` ou de `create_teacher`. Rend `classPeriodId`, `teacherId` et ' +
        "`alreadyAssigned` (vrai si l'affectation existait : rien n'est écrit). Refus : " +
        '`notFound` (classe), `teacherNotFound`, `validationError`.',
      inputSchema: mcpAssignTeacherSchema,
      annotations: IDEMPOTENT_WRITE,
      kind: 'write',
      run: (args) => assignTeacherFromMcp(scope, args),
    }),
    // Déclarés même quand `teacher_expenses_enabled` est éteint, comme les outils
    // d'événements : le refus `notConfigured` est le contrat.
    define({
      name: 'preview_record_teacher_expense',
      title: 'Préparer une note de dépense',
      description:
        "Résout une note de dépense d'enseignant — un ticket de goûter, de fournitures — sans " +
        "rien écrire. L'enseignant vient en `teacherName` (prénom, nom ou les deux) ou en " +
        "`teacherId`, jamais les deux. `amount` en décimal dans la devise de l'école ; " +
        '`requestedAt` et `paidAt` sont des jours (`2026-09-12`), `requestedAt` vaut ' +
        "aujourd'hui par défaut. Rend un `draftId`, un `checksum`, le plan résolu, les " +
        "candidats d'un nom ambigu, des avertissements (`possibleDuplicateExpense` pour une " +
        'note identique le même jour, `paidBeforeRequested`) et des `blockers` (`notFound`, ' +
        '`ambiguousTeacher`). Refus : `notConfigured`, `validationError`.',
      inputSchema: previewRecordTeacherExpenseSchema,
      annotations: NON_IDEMPOTENT_WRITE,
      kind: 'draft',
      run: (args) => previewRecordTeacherExpense(scope, args),
    }),
    define({
      name: 'commit_record_teacher_expense',
      title: 'Enregistrer une note de dépense',
      description:
        'Crée la note de dépense déjà prévisualisée. Rejouer le même `draftId` rend la note ' +
        "enregistrée au lieu d'en créer une seconde. Refus : `notConfigured`, `notFound` " +
        "(enseignant archivé depuis l'aperçu). Le brouillon expire au bout d'une demi-heure.",
      inputSchema: commitDraftSchema,
      annotations: IDEMPOTENT_COMMIT,
      kind: 'write',
      run: (args) => commitRecordTeacherExpense(scope, args),
    }),
    define({
      name: 'find_students',
      title: 'Chercher un élève',
      description:
        'Cherche des élèves par leur nom : chaque mot doit figurer dans le prénom ou le nom. ' +
        'Rend leur identifiant, leurs familles et leurs inscriptions ouvertes avec leur ' +
        `classe. Au plus ${MCP_STUDENT_SEARCH_MAX} résultats.`,
      inputSchema: mcpFindStudentsSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      kind: 'read',
      run: (args) => findStudentsFromMcp(scope, args),
    }),
    define({
      name: 'preview_merge_families',
      title: 'Préparer la fusion de familles',
      description:
        'Prépare la fusion de la famille source dans la famille cible conservée. ' +
        'Présente les membres et comptes des deux familles ainsi que les avertissements, ' +
        'notamment `expandedFamilyAccess`, avant confirmation. Rend un brouillon, son ' +
        '`checksum`, le plan et les éventuels `blockers`.',
      inputSchema: previewMergeFamiliesSchema,
      annotations: NON_IDEMPOTENT_WRITE,
      kind: 'draft',
      run: (args) => previewMergeFamilies(scope, args),
    }),
    define({
      name: 'commit_merge_families',
      title: 'Fusionner les familles',
      description:
        'Engage la fusion prévisualisée après validation humaine avec `draftId` et `checksum`. ' +
        'La famille source est archivée. Un plan modifié depuis sa validation est refusé ' +
        'avec `staleDraft`. Le brouillon expire après trente minutes et son rejeu rend le résultat enregistré.',
      inputSchema: commitDraftSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      kind: 'write',
      run: (args) => commitMergeFamilies(scope, args),
    }),
    define({
      name: 'get_family_deletion_impact',
      title: 'Voir ce que la suppression d’une famille effacera',
      description:
        'Lit une famille par son `id`, archives comprises, et compte les membres, élèves, ' +
        'inscriptions, paiements et présences qui seraient effacés. Les personnes liées ' +
        'à une autre famille sont préservées. Lecture seule, aucun brouillon créé. ' +
        'Présenter cet aperçu avant toute suppression et obtenir l’accord explicite. ' +
        'Refus : `notFound`, `validationError`.',
      inputSchema: mcpResourceIdSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      kind: 'read',
      run: (args) => getFamilyDeletionImpactFromMcp(scope, args),
    }),
    define({
      name: 'delete_family',
      title: 'Supprimer définitivement une famille',
      description:
        'Efface définitivement une famille et son dossier : membres exclusifs, élèves, ' +
        'inscriptions, présences, règlements, reçus et transactions. Irréversible. ' +
        'Appeler `get_family_deletion_impact`, présenter son résultat et obtenir un accord ' +
        'explicite avant cet appel. `confirmation` doit reprendre le nom de la famille. ' +
        'Une personne liée à une autre famille est conservée. Aucun archivage préalable requis. ' +
        'Refus : `confirmationMismatch`, `notFound`, `deletionBlocked`, `deletionConflict`, ' +
        '`validationError`. Une réponse positive rend `{ id, deleted: true }`.',
      inputSchema: mcpDeleteFamilySchema,
      annotations: DESTRUCTIVE_WRITE,
      kind: 'write',
      run: (args) => deleteFamilyFromMcp(scope, args),
    }),
    define({
      name: 'archive_student',
      title: 'Archiver un élève',
      description:
        'Masque un élève de l’école sans effacer son dossier. Refuse une inscription ' +
        'PENDING ou ACTIVE : `hasActiveEnrollments`. Arrête aussi ses prestations de repas. ' +
        'Refus : `notFound`, `validationError`. Rend `{ id, archived: true }`.',
      inputSchema: mcpResourceIdSchema,
      annotations: DESTRUCTIVE_WRITE,
      kind: 'write',
      run: (args) => archiveStudentFromMcp(scope, args),
    }),
    define({
      name: 'archive_class_period',
      title: 'Archiver une classe',
      description:
        'Archive une classe vide de l’école. Refuse toute affectation d’élève ou ' +
        'd’enseignant, tout créneau ou appel existant : `classInUse`. Refus : `notFound`, ' +
        '`validationError`. Rend `{ id, archived: true }`.',
      inputSchema: mcpResourceIdSchema,
      annotations: DESTRUCTIVE_WRITE,
      kind: 'write',
      run: (args) => archiveClassPeriodFromMcp(scope, args),
    }),
    define({
      name: 'archive_level',
      title: 'Archiver un niveau',
      description:
        'Masque un niveau de l’école, uniquement lorsqu’aucune classe active ne l’utilise ' +
        '(`levelInUse` sinon). Retire ses liens de progression. Refus : `notFound`, ' +
        '`validationError`. Rend `{ id, archived: true }`.',
      inputSchema: mcpResourceIdSchema,
      annotations: DESTRUCTIVE_WRITE,
      kind: 'write',
      run: (args) => archiveLevelFromMcp(scope, args),
    }),
    define({
      name: 'archive_plan',
      title: 'Archiver un forfait',
      description:
        'Masque un forfait de l’école sans modifier les inscriptions ni les montants. ' +
        'Refuse un forfait utilisé par une inscription PENDING ou ACTIVE (`planInUse`), ' +
        'la formule réservée sans tarif (`unpricedPlan`) et les paiements désactivés ' +
        '(`paymentsDisabled`). Autres refus : `notFound`, `validationError`. ' +
        'Rend `{ id, archived: true }`.',
      inputSchema: mcpResourceIdSchema,
      annotations: DESTRUCTIVE_WRITE,
      kind: 'write',
      run: (args) => archivePlanFromMcp(scope, args),
    }),
    define({
      name: 'preview_enroll_family',
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
      kind: 'draft',
      run: (args) => previewEnrollFamily(scope, args),
    }),
    define({
      name: 'commit_enroll_family',
      title: 'Engager une inscription de famille',
      description:
        "Crée la famille (ou reprend celle visée), ses parents, ses élèves, leurs inscriptions et l'encaissement du " +
        'plan déjà prévisualisé. Rejouer le même `draftId` rend le résultat enregistré au ' +
        "lieu de créer une seconde famille. Le brouillon expire au bout d'une demi-heure.",
      inputSchema: commitDraftSchema,
      annotations: IDEMPOTENT_COMMIT,
      kind: 'write',
      run: (args) => commitEnrollFamily(scope, args),
    }),
    // Déclarés même quand `events_enabled` est éteint, à l'inverse des outils d'argent : le
    // refus `notConfigured` de `createEvent` est ici le contrat, identique à celui de l'action
    // serveur, et lire le drapeau ici rendrait la construction du catalogue asynchrone.
    define({
      name: 'create_event',
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
      kind: 'write',
      run: (args) => createEventFromMcp(scope, args),
    }),
    define({
      name: 'list_events',
      title: 'Événements',
      description:
        "Événements actifs de l'école, tous statuts, du plus proche au plus lointain. `from` " +
        'et `to` sont des jours inclus (`2026-12-03`) bornant le début ; `status` filtre ' +
        `(\`DRAFT\` pour relire les brouillons) ; \`limit\` vaut ${MCP_EVENT_LIST_DEFAULT} par ` +
        `défaut, ${MCP_EVENT_LIST_MAX} au plus, et \`hasMore\` signale une page tronquée. ` +
        'Refus : `notConfigured`, `invalidDateRange`, `validationError`.',
      inputSchema: mcpListEventsSchema,
      kind: 'read',
      run: (args) => listEventsFromMcp(scope, args),
    }),
    define({
      name: 'get_event',
      title: 'Lire un événement',
      description:
        "Un événement de l'école avec son résumé, sa description et son annonce J-x. Refus : " +
        '`notFound` (inconnu ou archivé), `notConfigured`, `validationError`.',
      inputSchema: mcpEventIdSchema,
      kind: 'read',
      run: (args) => getEventFromMcp(scope, args),
    }),
    define({
      name: 'update_event',
      title: "Corriger un brouillon d'événement",
      description:
        'Modifie un événement encore en brouillon ; une clé absente garde sa valeur, `null` ' +
        'efface un champ facultatif. Dates au format de `create_event`. Aucun `status` : la ' +
        'publication se fait depuis le tableau de bord. Refus : `notDraft` (déjà publié ou ' +
        'annulé), `notFound`, `slugTaken`, `invalidDateRange`, `notConfigured`, `validationError`.',
      inputSchema: mcpUpdateEventSchema,
      annotations: IDEMPOTENT_OVERWRITE,
      kind: 'write',
      run: (args) => updateEventFromMcp(scope, args),
    }),
    define({
      name: 'duplicate_event',
      title: 'Reconduire un événement',
      description:
        "Copie un événement à l'année suivante, en brouillon et sans image, sous un nouveau " +
        "titre — un titre identique heurterait `slugTaken` : ajouter l'année. Refus : " +
        '`notFound`, `slugTaken`, `notConfigured`, `validationError`.',
      inputSchema: mcpDuplicateEventSchema,
      annotations: NON_IDEMPOTENT_WRITE,
      kind: 'write',
      run: (args) => duplicateEventFromMcp(scope, args),
    })
  )

  // Les outils d'argent ci-dessous ne se déclarent pas quand l'école a coupé les
  // paiements : un outil absent ne trompe pas l'agent, alors qu'un outil déclaré qui
  // refuserait systématiquement l'inviterait à insister ou à mal lire le refus. C'est le
  // mécanisme premier ; les use cases eux-mêmes refusent aussi, en défense en profondeur.
  if (scope.paymentsEnabled) {
    tools.push(
      define({
        name: 'preview_record_payment',
        title: 'Préparer un encaissement',
        description:
          'Résout la famille, ventile le montant sur ses inscriptions actives et rend la ' +
          'répartition sans rien écrire. La famille se désigne par son identifiant, par ' +
          "l'identifiant d'un de ses élèves (`studentId`) ou par son nom ; un nom ou un élève " +
          'qui vise plusieurs familles est un `blocker`. Valeurs par défaut : le montant est ' +
          "tout le reste à payer, le moyen `CASH`, la date aujourd'hui — ne les demander que " +
          "si l'utilisateur veut autre chose. Le montant est réparti sur toute la famille ; " +
          "quand l'utilisateur dit pour quel enfant la famille paie, passer `target: 'student'` " +
          'avec son `studentId` (son unique inscription payable reçoit tout, et le montant par ' +
          'défaut devient son reste) ou `enrollmentId`. Refus : `overpayment` au-delà du reste ' +
          "de l'inscription visée, `enrollmentNotPayable` hors des inscriptions payables de la " +
          'famille, `ambiguousEnrollment` si l’élève en a plusieurs.',
        inputSchema: previewRecordPaymentSchema,
        annotations: NON_IDEMPOTENT_WRITE,
        kind: 'draft',
        run: (args) => previewRecordPayment(scope, args),
      }),
      define({
        name: 'commit_record_payment',
        title: 'Engager un encaissement',
        description:
          'Écrit les paiements de la répartition déjà prévisualisée, sur la même cible ' +
          '(famille ou inscription). Rejouer le même ' +
          '`draftId` rend le résultat enregistré au lieu de doubler le versement.',
        inputSchema: commitDraftSchema,
        annotations: IDEMPOTENT_COMMIT,
        kind: 'write',
        run: (args) => commitRecordPayment(scope, args),
      }),
      define({
        name: 'preview_update_enrollment',
        title: "Préparer la modification d'une inscription",
        description:
          "Change la formule et/ou la remise d'une inscription en attente ou active, sans rien " +
          "écrire. L'inscription se désigne par son identifiant, ou par le prénom et le nom de " +
          "l'élève ; la formule est attendue en libellé. Sans remise, l'inscription garde la " +
          'sienne. Rend le passage « avant → après », le total recalculé et le reste à payer ; ' +
          'plusieurs inscriptions candidates sont un `blocker` qui les liste.',
        inputSchema: previewUpdateEnrollmentSchema,
        annotations: NON_IDEMPOTENT_WRITE,
        kind: 'draft',
        run: (args) => previewUpdateEnrollment(scope, args),
      }),
      define({
        name: 'commit_update_enrollment',
        title: "Engager la modification d'une inscription",
        description:
          'Applique la formule, la remise et le total déjà prévisualisés. Les paiements ' +
          "restent sur l'inscription. Rejouer le même `draftId` rend le résultat enregistré.",
        inputSchema: commitDraftSchema,
        annotations: IDEMPOTENT_COMMIT,
        kind: 'write',
        run: (args) => commitUpdateEnrollment(scope, args),
      }),
      define({
        name: 'get_family_payments',
        title: "Paiements d'une famille",
        description:
          "Reste à payer d'une famille, par inscription, et ses 20 derniers paiements actifs " +
          'avec leur identifiant. `tracking` distingue montant attendu à ce jour, retard et suivi actif ; ' +
          '`paidAmount` donne le montant reçu sur les inscriptions ouvertes. Sans suivi, le solde ' +
          'annuel restant n’est pas un retard. Sert aussi à retrouver un paiement avant de l’annuler.',
        inputSchema: mcpFamilyPaymentsSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        kind: 'read',
        run: (args) => familyPaymentsFromMcp(scope, args),
      }),
      define({
        name: 'cancel_payments',
        title: 'Annuler des paiements',
        description:
          "Annule des paiements saisis par erreur : ils sortent des soldes et de l'historique, " +
          'sans être effacés. Les identifiants se trouvent avec `get_family_payments`. Tous ' +
          'doivent appartenir à la même famille ; un paiement en ligne (Stripe) est refusé, il ' +
          'se rembourse depuis Stripe ; un paiement de caisse aussi, il s’annule avec son reçu ' +
          '(`cancel_receipt`). `reason`, facultatif, est conservé avec l’auteur de l’annulation.',
        inputSchema: mcpCancelPaymentsSchema,
        annotations: DESTRUCTIVE_WRITE,
        kind: 'write',
        run: (args) => cancelPaymentsFromMcp(scope, args),
      })
    )
  }

  return tools
}
