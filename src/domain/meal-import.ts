import { type FamilyLink, resolveDebtorFamily } from './family-debtor'
import { servedDays, servedDaysThrough, validateMealWeekdays } from './meal-ledger'
import { normalizeRosterText } from './roster-import'

type MealImportService = 'CANTEEN' | 'SNACK'

type MealImportName = { lastname: string; name: string }

type MealImportCoverage =
  | { state: 'paid'; paidThrough: string }
  | { state: 'unpaid' }
  | { state: 'uncertain' | 'unknown'; piece: string; proposedPaidThrough?: string }

export type MealImportLine = MealImportName & {
  service: MealImportService
  className: string
  aliases?: MealImportName[]
  studentId?: string
  weekdays: 'usual' | number[]
  startOn: string
  hold?: string
  coverage: MealImportCoverage
  familyCode?: string
  water?: boolean
  note?: string
}

export type MealImportStudent = MealImportName & {
  id: string
  className: string | null
  families: FamilyLink[]
}

type StoredAccount = {
  segments: ReadonlyArray<{ weekdays: readonly number[]; startOn: string; endOn: string | null }>
  openings: ReadonlyArray<{ days: number; reason: string }>
  payments: ReadonlyArray<{ amount: number; daysAdded: number; on: string }>
}

type Identity =
  | { status: 'resolved'; studentId: string; familyId: string; via: 'id' | 'name' | 'alias' }
  | { status: 'unknown' | 'ambiguous' | 'noFamily' | 'duplicate'; candidates: string[] }

type Subscription = 'create' | 'present' | 'conflict' | 'held' | 'blocked' | 'invalidWeekdays'

type Balance = 'confirmed' | 'toReconcile' | 'retained'

type Opening =
  | { status: 'create' | 'present'; days: number; reason: string }
  | { status: 'conflict' | 'reconcile'; days: number; detail: string }
  | { status: 'none' | 'pending' }

export type MealImportDecision = {
  line: MealImportLine
  identity: Identity
  weekdays: readonly number[]
  subscription: Subscription
  opening: Opening
  ready: boolean
  balance: Balance
  warnings: string[]
}

export type MealImportContext = {
  constatDate: string
  periodEnd: string
  usualWeekdays: readonly number[]
  allowedWeekdays: Record<MealImportService, readonly number[]>
  isClosed: (day: string) => boolean
}

const matchKey = (person: MealImportName) =>
  normalizeRosterText(`${person.lastname} ${person.name}`.replace(/[-_]/g, ' '))

const fullName = (person: MealImportName) => `${person.lastname} ${person.name}`

export const mealImportOpeningReason = (constatDate: string, paidThrough: string) =>
  `Reprise du constat du ${constatDate} : payé jusqu'au ${paidThrough}`

function candidatesFor(line: MealImportLine, students: readonly MealImportStudent[]) {
  const token = matchKey({ lastname: '', name: line.name }).split(' ')[0] ?? ''
  return students
    .filter((student) => token && matchKey(student).split(' ').includes(token))
    .map(fullName)
}

function identify(line: MealImportLine, students: readonly MealImportStudent[]): Identity {
  const debtor = (student: MealImportStudent, via: 'id' | 'name' | 'alias'): Identity => {
    const family = resolveDebtorFamily(student.families)
    return family
      ? { status: 'resolved', studentId: student.id, familyId: family.familyId, via }
      : { status: 'noFamily', candidates: [fullName(student)] }
  }

  if (line.studentId) {
    const student = students.find((item) => item.id === line.studentId)
    return student ? debtor(student, 'id') : { status: 'unknown', candidates: [] }
  }
  for (const [names, via] of [
    [[line], 'name'],
    [line.aliases ?? [], 'alias'],
  ] as const) {
    const keys = new Set(names.map(matchKey))
    const found = students.filter((student) => keys.has(matchKey(student)))
    if (found.length > 1) return { status: 'ambiguous', candidates: found.map(fullName) }
    const [student] = found
    if (student) return debtor(student, via)
  }
  return { status: 'unknown', candidates: candidatesFor(line, students) }
}

function planSubscription(
  line: MealImportLine,
  weekdays: readonly number[],
  account: StoredAccount | undefined,
  context: MealImportContext
): Subscription {
  const same = (segment: StoredAccount['segments'][number]) =>
    segment.startOn === line.startOn &&
    segment.endOn === null &&
    [...segment.weekdays].sort().join() === [...weekdays].sort().join()

  if (validateMealWeekdays(weekdays, context.allowedWeekdays[line.service]) !== 'OK') {
    return 'invalidWeekdays'
  }
  const segments = account?.segments ?? []
  if (segments.length === 0) return line.hold ? 'held' : 'create'
  return segments.length === 1 && segments.every(same) ? 'present' : 'conflict'
}

function planOpening(
  line: MealImportLine,
  weekdays: readonly number[],
  subscription: Subscription,
  account: StoredAccount | undefined,
  context: MealImportContext
): Opening {
  if (line.coverage.state !== 'paid') return { status: 'none' }
  if (subscription !== 'create' && subscription !== 'present') return { status: 'pending' }

  const { paidThrough } = line.coverage
  const days = servedDaysThrough(
    servedDays({
      segments: [{ weekdays, startOn: line.startOn, endOn: null }],
      periodEnd: paidThrough < context.periodEnd ? paidThrough : context.periodEnd,
      isClosed: context.isClosed,
    }),
    paidThrough
  )
  const reason = mealImportOpeningReason(context.constatDate, paidThrough)
  const [opening] = account?.openings ?? []
  if (opening) {
    return opening.reason === reason && opening.days === days
      ? { status: 'present', days, reason }
      : { status: 'conflict', days, detail: `${opening.days} j. : ${opening.reason}` }
  }
  const payments = account?.payments ?? []
  if (payments.length > 0) {
    const detail = payments.map((item) => `${item.on} ${item.amount} (${item.daysAdded} j.)`)
    return { status: 'reconcile', days, detail: detail.join(', ') }
  }
  return days > 0 ? { status: 'create', days, reason } : { status: 'none' }
}

const isSubscribable = (subscription: Subscription) =>
  subscription === 'create' || subscription === 'present'

function isReady(
  subscription: Subscription,
  line: MealImportLine,
  opening: Opening,
  account: StoredAccount | undefined
) {
  if (!isSubscribable(subscription)) return false
  if (line.coverage.state === 'unpaid') {
    return !account?.payments.length && !account?.openings.length
  }
  return opening.status === 'create' || opening.status === 'present'
}

function balanceOf(subscription: Subscription, ready: boolean): Balance {
  if (ready) return 'confirmed'
  return isSubscribable(subscription) ? 'toReconcile' : 'retained'
}

function warningsFor(
  line: MealImportLine,
  student: MealImportStudent | undefined,
  account: StoredAccount | undefined
) {
  const warnings: string[] = []
  if (
    student?.className &&
    normalizeRosterText(student.className) !== normalizeRosterText(line.className)
  ) {
    warnings.push(`classe source ${line.className}, base ${student.className} : inchangée`)
  }
  if (student && student.families.length > 1) warnings.push('plusieurs familles rattachées')
  if (account?.payments.length && line.coverage.state !== 'paid') {
    warnings.push(`${account.payments.length} encaissement(s) déjà saisi(s) à rapprocher`)
  }
  if (account?.openings.length && line.coverage.state !== 'paid') {
    warnings.push('ouverture déjà saisie à rapprocher')
  }
  return warnings
}

const accountKey = (studentId: string, service: MealImportService) => `${studentId}|${service}`

export { accountKey as mealImportAccountKey }

/** Décide ligne par ligne, sans rien écrire : aucune ligne douteuse ne bloque les autres. */
export function planMealImport(
  lines: readonly MealImportLine[],
  students: readonly MealImportStudent[],
  accounts: ReadonlyMap<string, StoredAccount>,
  context: MealImportContext
): MealImportDecision[] {
  const identities = lines.map((line) => identify(line, students))
  const seen = new Map<string, number>()
  identities.forEach((identity, index) => {
    if (identity.status !== 'resolved') return
    const key = accountKey(identity.studentId, lines[index]?.service ?? 'CANTEEN')
    seen.set(key, (seen.get(key) ?? 0) + 1)
  })

  return lines.map((line, index) => {
    const found = identities[index] as Identity
    const weekdays = line.weekdays === 'usual' ? context.usualWeekdays : line.weekdays
    const key = found.status === 'resolved' ? accountKey(found.studentId, line.service) : null
    const repeated = key !== null && (seen.get(key) ?? 0) > 1
    const identity: Identity = repeated
      ? { status: 'duplicate', candidates: [fullName(line)] }
      : found
    const account = key ? accounts.get(key) : undefined
    const student =
      found.status === 'resolved' ? students.find((item) => item.id === found.studentId) : undefined

    const subscription =
      identity.status === 'resolved'
        ? planSubscription(line, weekdays, account, context)
        : 'blocked'
    const opening = planOpening(line, weekdays, subscription, account, context)
    const ready = isReady(subscription, line, opening, account)
    return {
      line,
      identity,
      weekdays,
      subscription,
      opening,
      ready,
      balance: balanceOf(subscription, ready),
      warnings: warningsFor(line, student, account),
    }
  })
}

/** Groupes de l'ancien fichier répartis sur plusieurs familles redevables en base. */
export function splitFamilyCodes(decisions: readonly MealImportDecision[]) {
  const families = new Map<string, Set<string>>()
  for (const { line, identity } of decisions) {
    if (!line.familyCode || identity.status !== 'resolved') continue
    const set = families.get(line.familyCode) ?? new Set<string>()
    families.set(line.familyCode, set.add(identity.familyId))
  }
  return [...families].filter(([, ids]) => ids.size > 1).map(([code]) => code)
}

export function summarizeMealImport(decisions: readonly MealImportDecision[]) {
  const summary = (service: MealImportService) => {
    const rows = decisions.filter(({ line }) => line.service === service)
    const count = (test: (row: MealImportDecision) => boolean) => rows.filter(test).length
    return {
      target: rows.length,
      subscribable: count((row) => ['create', 'present'].includes(row.subscription)),
      held: count((row) => row.subscription === 'held'),
      blocked: count((row) =>
        ['blocked', 'conflict', 'invalidWeekdays'].includes(row.subscription)
      ),
      openings: count((row) => ['create', 'present'].includes(row.opening.status)),
      ready: count((row) => row.ready),
      toReconcile: count((row) => row.balance === 'toReconcile'),
      retained: count((row) => row.balance === 'retained'),
    }
  }
  const students = new Set<string>()
  for (const { identity } of decisions) {
    if (identity.status === 'resolved') students.add(identity.studentId)
  }
  return {
    canteen: summary('CANTEEN'),
    snack: summary('SNACK'),
    distinctStudents: students.size,
    water: decisions.filter(({ line }) => line.water).length,
  }
}

/** Totaux affichés à chaque passage : un abonnement écrit ne dit rien du solde du compte. */
export function mealImportCoverageLines(decisions: readonly MealImportDecision[]) {
  const count = (balance: Balance) =>
    decisions.filter((decision) => decision.balance === balance).length
  const confirmed = count('confirmed')
  const paid = decisions.filter(
    ({ balance, line }) => balance === 'confirmed' && line.coverage.state === 'paid'
  ).length
  return [
    `Couverture de ${decisions.length} ligne(s) : ${confirmed} confirmée(s) ` +
      `(${paid} payée(s), ${confirmed - paid} non payée(s)), ` +
      `${count('toReconcile')} inconnue(s) ou à rapprocher, ${count('retained')} retenue(s).`,
    'Un abonnement appliqué ne valide pas le solde : aucune dette, aucun crédit ' +
      'ni aucune exonération écrits, les comptes à rapprocher restent à contrôler par l’école.',
  ]
}
