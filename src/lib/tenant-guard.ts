/**
 * Garde tenant fail-closed.
 *
 * N'injecte rien : détecte une requête racine non scopée sur un modèle appartenant
 * à une école et la rejette. `warn`, qui journalise la violation avec sa pile
 * d'appel au lieu de la rejeter, a servi à dresser la liste des lectures à scoper ;
 * il ne reste qu'un outil de diagnostic.
 *
 * Portée volontairement limitée à la RACINE des requêtes. Les écritures imbriquées
 * ne sont pas visibles depuis une extension Prisma ; leur cohérence est garantie
 * par les clés étrangères composites `(fk, schoolId) -> Parent(id, schoolId)`.
 *
 * Ce module est pur et sans dépendance à Prisma, afin d'être testable en unité :
 * les tests du dépôt remplacent `@/lib/db` en entier et ne traverseraient jamais
 * l'extension.
 */

/**
 * Les 29 modèles portant un `schoolId`. `SchoolMember` en est volontairement absent :
 * c'est la table de découverte, lue par `userId` avant qu'une école soit connue.
 * `McpApiKey` aussi : la clé est résolue par son hachage avant que l'école soit connue.
 * `McpOAuthGrant` y figure : un jeton se résout par `McpOAuthToken`, sans `schoolId`, et
 * toute requête qui vise la connexion elle-même connaît déjà son école — sauf le décompte
 * avant suppression d'un compte, exception 3 de `src/lib/db-unscoped.ts`.
 */
const TENANT_SCOPED_MODELS: Record<string, true> = {
  Family: true,
  UserFamily: true,
  Person: true,
  FamilyPerson: true,
  Student: true,
  PhoneNumber: true,
  Config: true,
  Level: true,
  LevelProgression: true,
  Period: true,
  ClassPeriod: true,
  Enrollment: true,
  ClassAssignment: true,
  AttendanceSession: true,
  AttendanceEntry: true,
  Payment: true,
  PaymentTransaction: true,
  Plan: true,
  Invitation: true,
  Teacher: true,
  ClassPeriodTeacher: true,
  ClassScheduleSlot: true,
  ClassScheduleSlotTeacher: true,
  TeacherExpense: true,
  McpDraft: true,
  McpOAuthGrant: true,
  AiConversation: true,
  Event: true,
  EventImage: true,
}

const WHERE_OPERATIONS: Record<string, true> = {
  findFirst: true,
  findFirstOrThrow: true,
  findMany: true,
  findUnique: true,
  findUniqueOrThrow: true,
  count: true,
  aggregate: true,
  groupBy: true,
  update: true,
  updateMany: true,
  updateManyAndReturn: true,
  delete: true,
  deleteMany: true,
}

const MANY_DATA_OPERATIONS: Record<string, true> = {
  createMany: true,
  createManyAndReturn: true,
}

const MUTATION_OPERATIONS: Record<string, true> = {
  update: true,
  updateMany: true,
  updateManyAndReturn: true,
}

type TenantViolationReason = 'missingScopeInWhere' | 'missingScopeInData' | 'tenantReassignment'

const REASON_MESSAGES: Record<TenantViolationReason, string> = {
  missingScopeInWhere:
    'le `where` ne contraint pas `schoolId` (ni directement, ni via un sélecteur composé)',
  missingScopeInData: '`data` ne fournit pas `schoolId`',
  tenantReassignment: "réaffectation d'école interdite sur une ligne existante",
}

export type TenantViolation = {
  model: string
  operation: string
  reason: TenantViolationReason
}

export type TenantGuardMode = 'off' | 'warn' | 'throw'

/**
 * Les arguments Prisma sont opaques au niveau de l'extension. On ne décrit que les
 * champs inspectés ; leur contenu reste `unknown` et est vérifié plus bas.
 */
type QueryArguments = {
  where?: unknown
  data?: unknown
  create?: unknown
  update?: unknown
}

/**
 * `schoolId: 'x'`, `schoolId: { equals: 'x' }` ou `schoolId: { in: [...] }`.
 * La forme `in` est requise par la résolution des liens profonds, qui interroge
 * en une seule requête les écoles autorisées d'un utilisateur.
 */
function constrainsSchoolId(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0
  if (typeof value !== 'object' || value === null) return false

  if ('equals' in value && typeof value.equals === 'string') return true
  return 'in' in value && Array.isArray(value.in) && value.in.length > 0
}

/**
 * Accepte `schoolId` posé directement, ou porté par n'importe quel sélecteur unique
 * composé généré par Prisma qui le contient — `id_schoolId`, `schoolId_name`,
 * `personId_schoolId`, `userId_schoolId`… Traverse aussi un `AND` de premier niveau.
 */
function whereHasSchoolScope(where: unknown): boolean {
  if (typeof where !== 'object' || where === null) return false

  if ('schoolId' in where && constrainsSchoolId(where.schoolId)) return true

  for (const [selector, value] of Object.entries(where)) {
    if (!selector.split('_').includes('schoolId')) continue
    if (typeof value !== 'object' || value === null) continue
    if ('schoolId' in value && constrainsSchoolId(value.schoolId)) return true
  }

  if ('AND' in where && Array.isArray(where.AND)) {
    return where.AND.some((nested) => whereHasSchoolScope(nested))
  }

  return false
}

function dataHasSchoolScope(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false

  if ('schoolId' in data && typeof data.schoolId === 'string' && data.schoolId.length > 0) {
    return true
  }

  if (!('school' in data)) return false
  const school = data.school
  if (typeof school !== 'object' || school === null || !('connect' in school)) return false

  const connect = school.connect
  if (typeof connect !== 'object' || connect === null) return false
  return 'id' in connect && typeof connect.id === 'string'
}

/**
 * Toute tentative de déplacer une ligne d'une école à l'autre, y compris via la
 * relation `school` — que contrôler `data.schoolId` seul laisserait passer.
 */
function dataReassignsTenant(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  if ('schoolId' in data) return true

  if (!('school' in data)) return false
  const school = data.school
  if (typeof school !== 'object' || school === null) return false
  return 'connect' in school || 'disconnect' in school
}

export function findTenantViolation(
  model: string | undefined,
  operation: string,
  args: unknown
): TenantViolation | null {
  if (!model || TENANT_SCOPED_MODELS[model] !== true) return null

  // Prisma garantit un objet d'arguments à ce point de l'extension ; chaque champ
  // reste `unknown` et est vérifié individuellement.
  const parameters = (args ?? {}) as QueryArguments

  const violation = (reason: TenantViolationReason): TenantViolation => ({
    model,
    operation,
    reason,
  })

  if (operation === 'upsert') {
    if (!whereHasSchoolScope(parameters.where)) return violation('missingScopeInWhere')
    if (!dataHasSchoolScope(parameters.create)) return violation('missingScopeInData')
    if (dataReassignsTenant(parameters.update)) return violation('tenantReassignment')
    return null
  }

  if (MANY_DATA_OPERATIONS[operation] === true) {
    const rows = Array.isArray(parameters.data) ? parameters.data : [parameters.data]
    return rows.every(dataHasSchoolScope) ? null : violation('missingScopeInData')
  }

  if (operation === 'create') {
    return dataHasSchoolScope(parameters.data) ? null : violation('missingScopeInData')
  }

  if (WHERE_OPERATIONS[operation] === true) {
    if (MUTATION_OPERATIONS[operation] === true && dataReassignsTenant(parameters.data)) {
      return violation('tenantReassignment')
    }
    return whereHasSchoolScope(parameters.where) ? null : violation('missingScopeInWhere')
  }

  return null
}

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TenantScopeError'
  }
}

/**
 * `throw` par défaut, et ce repli est le seul réglage que développement, test,
 * intégration continue et production lisent : `TENANT_GUARD_MODE` n'est posé dans
 * aucune configuration du dépôt. `warn` et `off` restent disponibles pour un
 * diagnostic ponctuel, jamais comme mode de fonctionnement.
 */
export function tenantGuardMode(): TenantGuardMode {
  const mode = process.env.TENANT_GUARD_MODE
  if (mode === 'off' || mode === 'throw' || mode === 'warn') return mode
  return 'throw'
}

export function reportTenantViolation(violation: TenantViolation, mode: TenantGuardMode): void {
  if (mode === 'off') return

  const message = `[tenant-guard] ${violation.model}.${violation.operation} : ${REASON_MESSAGES[violation.reason]}`
  if (mode === 'throw') throw new TenantScopeError(message)

  // La pile nomme l'appelant restant à scoper : c'est ce qui rend le journal exploitable.
  console.warn(message, new Error('tenant-guard').stack)
}
