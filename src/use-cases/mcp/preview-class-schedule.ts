import type { z } from 'zod'
import { validateWeeklyTimeRange, weeklyTimeRangesOverlap } from '@/domain/class-schedule'
import type { McpFinding } from '@/domain/mcp-draft'
import { classScheduleGateway } from '@/gateways/class-schedule-gateway'
import { configGateway } from '@/gateways/config-gateway'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { CLASS_SCHEDULE_TEACHER_OVERLAP_ALLOWED_CONFIG_KEY } from '@/lib/class-schedule-config'
import { isClassScheduleEnabled } from '@/use-cases/class-schedules/is-class-schedule-enabled'
import { blockedPreview, saveDraftPreview } from './draft-response'
import type { DraftScope } from './draft-scope'
import { matchByName } from './match-by-name'
import { previewClassScheduleSchema } from './schemas'

// `z.input`, pas `z.infer` : l'entrée vient d'un modèle et traverse le schéma — un défaut
// y est absent.
type Input = z.input<typeof previewClassScheduleSchema>

export const CLASS_SCHEDULE_TOOL = 'class_schedule'

type Teacher = { id: string; firstName: string; lastName: string }
type NamedRef = { id: string; name: string }

type ResolvedSlot = {
  classPeriod: NamedRef
  weekday: number
  startTime: string
  endTime: string
  description: string | null
  teachers: Teacher[]
}

type ExistingSlot = {
  id: string
  classPeriodId: string
  weekday: number
  startTime: string
  endTime: string
  teacherIds: string[]
}

/**
 * Un planning nomme un enseignant comme on le dit : « Mme Ali », « Fatima », « Ali Fatima ».
 * L'égalité sur le nom complet dans un ordre ou l'autre, le prénom seul ou le nom seul
 * passe d'abord ; la sous-chaîne sur le nom complet ensuite, et deux candidats restants
 * sont une ambiguïté à rendre, pas à trancher.
 */
function matchTeacher(rows: Teacher[], label: string): Teacher[] {
  const wanted = label.trim().toLowerCase()
  const exact = rows.filter((row) =>
    [
      `${row.firstName} ${row.lastName}`,
      `${row.lastName} ${row.firstName}`,
      row.firstName,
      row.lastName,
    ].some((name) => name.trim().toLowerCase() === wanted)
  )
  if (exact.length > 0) return exact
  return rows.filter((row) => `${row.firstName} ${row.lastName}`.toLowerCase().includes(wanted))
}

function sameRange(
  left: ResolvedSlot,
  right: { weekday: number; startTime: string; endTime: string }
) {
  return (
    left.weekday === right.weekday &&
    left.startTime === right.startTime &&
    left.endTime === right.endTime
  )
}

function sharesTeacher(left: { teachers: Teacher[] }, right: { teacherIds: string[] }) {
  return left.teachers.some((teacher) => right.teacherIds.includes(teacher.id))
}

export async function previewClassSchedule(scope: DraftScope, input: Input) {
  const parsed = previewClassScheduleSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  // Avant toute lecture : un planning coupé ne doit ni lister les classes ni proposer un
  // brouillon, comme les outils unitaires refusent avant de lire la classe.
  if (!(await isClassScheduleEnabled(schoolId))) return 'notConfigured' as const
  const data = parsed.data

  const blockers: McpFinding[] = []
  const warnings: McpFinding[] = []
  const matches = {
    classes: [] as NamedRef[],
    teachers: [] as Teacher[],
    existingSlots: [] as Array<{
      id: string
      classPeriodId: string
      weekday: number
      startTime: string
      endTime: string
    }>,
  }

  const period = (await mcpReadGateway.listPeriods(schoolId)).find(
    (row) => row.id === data.periodId
  )
  if (!period) {
    blockers.push({ field: 'periodId', value: data.periodId, reason: 'notFound' })
    return blockedPreview(matches, warnings, blockers)
  }

  const classes = (await mcpReadGateway.listClassPeriods(schoolId)).filter(
    (row) => row.period.id === period.id
  )
  // Les enseignants de l'école ne servent qu'à distinguer « inconnu » de « pas affecté à
  // cette classe » : le second se corrige depuis la classe, le premier depuis le libellé.
  const schoolTeachers = await mcpReadGateway.listTeachers(schoolId)

  const resolved: ResolvedSlot[] = []
  data.slots.forEach((slot, index) => {
    const field = (name: string) => `slots.${index}.${name}`

    if (validateWeeklyTimeRange(slot) !== 'OK') {
      blockers.push({ field: field('endTime'), value: slot.endTime, reason: 'invalidTimeRange' })
    }

    const classCandidates = matchByName(classes, slot.className)
    if (classCandidates.length !== 1) {
      blockers.push({
        field: field('className'),
        value: slot.className,
        reason: classCandidates.length === 0 ? 'notFound' : 'ambiguousClass',
      })
      for (const candidate of classCandidates) {
        if (!matches.classes.some((row) => row.id === candidate.id)) {
          matches.classes.push({ id: candidate.id, name: candidate.name })
        }
      }
      return
    }
    const classPeriod = classCandidates[0]
    const assigned = classPeriod.teachers.map((row) => row.teacher)

    const teachers: Teacher[] = []
    slot.teacherNames.forEach((label, teacherIndex) => {
      const teacherField = field(`teacherNames.${teacherIndex}`)
      const candidates = matchTeacher(assigned, label)
      if (candidates.length === 1) {
        if (!teachers.some((row) => row.id === candidates[0].id)) teachers.push(candidates[0])
        return
      }
      if (candidates.length > 1) {
        blockers.push({ field: teacherField, value: label, reason: 'ambiguousTeacher' })
        for (const candidate of candidates) {
          if (!matches.teachers.some((row) => row.id === candidate.id)) {
            matches.teachers.push(candidate)
          }
        }
        return
      }
      const known = matchTeacher(schoolTeachers, label)
      blockers.push({
        field: teacherField,
        value: label,
        reason: known.length > 0 ? 'teacherNotAssigned' : 'notFound',
      })
    })

    resolved[index] = {
      classPeriod: { id: classPeriod.id, name: classPeriod.name },
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      description: slot.description ?? null,
      teachers,
    }
  })

  const existingInPeriod = (
    await mcpReadGateway.listClassScheduleSlots(schoolId, period.id)
  ).map<ExistingSlot>((row) => ({
    id: row.id,
    classPeriodId: row.classPeriod.id,
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    teacherIds: row.teachers.map((assignment) => assignment.teacher.id),
  }))

  // Le refus `teacherOverlap` du gateway regarde toute l'école, pas seulement la période :
  // un enseignant occupé le samedi matin par une autre année l'est aussi pour celle-ci.
  const teacherIds = [...new Set(resolved.flatMap((slot) => slot.teachers.map((t) => t.id)))]
  const existingByTeacher = (
    await classScheduleGateway.listByTeachers(schoolId, teacherIds)
  ).map<ExistingSlot>((row) => ({
    id: row.id,
    classPeriodId: row.classPeriodId,
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    teacherIds: row.teachers.map((assignment) => assignment.teacherId),
  }))

  const overlapConfig = await configGateway.get(
    schoolId,
    CLASS_SCHEDULE_TEACHER_OVERLAP_ALLOWED_CONFIG_KEY
  )
  const teacherFindings = overlapConfig?.value === 'false' ? blockers : warnings

  const rememberExisting = (row: ExistingSlot) => {
    if (matches.existingSlots.some((known) => known.id === row.id)) return
    const { teacherIds: _teacherIds, ...projection } = row
    matches.existingSlots.push(projection)
  }

  resolved.forEach((slot, index) => {
    const field = (name: string) => `slots.${index}.${name}`

    // Le lot d'abord : la ligne qui répète ou chevauche une ligne précédente est celle à
    // corriger, et la première reste juge.
    for (let earlier = 0; earlier < index; earlier++) {
      const other = resolved[earlier]
      if (!other) continue
      if (other.classPeriod.id === slot.classPeriod.id) {
        if (sameRange(slot, other)) {
          blockers.push({
            field: field('startTime'),
            value: `slots.${earlier}`,
            reason: 'duplicateSlot',
          })
          continue
        }
        if (weeklyTimeRangesOverlap(slot, other)) {
          blockers.push({
            field: field('startTime'),
            value: `slots.${earlier}`,
            reason: 'classOverlap',
          })
          continue
        }
      }
      if (
        weeklyTimeRangesOverlap(slot, other) &&
        slot.teachers.some((teacher) => other.teachers.some((row) => row.id === teacher.id))
      ) {
        teacherFindings.push({
          field: field('teacherNames'),
          value: `slots.${earlier}`,
          reason: 'teacherOverlap',
        })
      }
    }

    for (const existing of existingInPeriod) {
      if (existing.classPeriodId !== slot.classPeriod.id) continue
      if (sameRange(slot, existing)) {
        blockers.push({ field: field('startTime'), value: existing.id, reason: 'alreadyExists' })
        rememberExisting(existing)
      } else if (weeklyTimeRangesOverlap(slot, existing)) {
        blockers.push({ field: field('startTime'), value: existing.id, reason: 'classOverlap' })
        rememberExisting(existing)
      }
    }

    for (const existing of existingByTeacher) {
      // Un créneau de la même classe est déjà rendu ci-dessus, en conflit de classe.
      if (existing.classPeriodId === slot.classPeriod.id) continue
      if (!weeklyTimeRangesOverlap(slot, existing) || !sharesTeacher(slot, existing)) continue
      teacherFindings.push({
        field: field('teacherNames'),
        value: existing.id,
        reason: 'teacherOverlap',
      })
      rememberExisting(existing)
    }
  })

  if (blockers.length > 0) return blockedPreview(matches, warnings, blockers)

  const plan = {
    tool: CLASS_SCHEDULE_TOOL,
    period: { id: period.id, name: period.name },
    slots: resolved,
  }

  return saveDraftPreview(scope, CLASS_SCHEDULE_TOOL, plan, matches, warnings, blockers)
}
