import { z } from 'zod'
import { isCurrencyAmount } from '@/domain/enrollment'
import { MCP_DRAFT_CHECKSUM_LENGTH } from '@/domain/mcp-draft'
import { MCP_KEY_LIFETIMES_DAYS } from '@/domain/mcp-key'
import {
  createClassScheduleSlotSchema,
  deleteClassScheduleSlotSchema,
  updateClassScheduleSlotSchema,
} from '@/use-cases/class-schedules/schemas'
import { EVENT_CATEGORIES, EVENT_STATUSES, EVENT_VISIBILITIES } from '@/use-cases/events/schemas'

export const createMcpApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  lifetimeDays: z.literal(MCP_KEY_LIFETIMES_DAYS),
})

const phoneNumberFormat = /^\+?[\d\s().-]{6,20}$/

/**
 * Les dates d'entrée restent des chaînes ISO, jamais un `z.coerce.date()`.
 *
 * Le SDK convertit chaque `inputSchema` en JSON Schema pour répondre à `tools/list`, et
 * une `ZodDate` n'y a pas de représentation : un seul champ suffit à faire échouer le
 * listing de **tous** les outils, lecture comprise, donc à rendre le serveur inutilisable.
 * La conversion en `Date` appartient au use case, après le `safeParse`.
 *
 * Le jour seul et l'horodatage complet sont acceptés pour un encaissement : un reçu porte
 * parfois l'horodatage du terminal.
 */
const isoDate = z.union([z.iso.date(), z.iso.datetime({ offset: true })])

export const MCP_STUDENT_SEARCH_DEFAULT = 10
export const MCP_STUDENT_SEARCH_MAX = 25

export const mcpPaymentMethodSchema = z.enum(['CASH', 'CARD', 'TRANSFER', 'CHECK'])

export const mcpSexSchema = z.enum(['MALE', 'FEMALE'])

const mcpPersonSchema = z.object({
  name: z.string().trim().min(1).max(250),
  lastname: z.string().trim().min(1).max(250),
  sex: mcpSexSchema.optional(),
})

const mcpParentSchema = mcpPersonSchema.extend({
  email: z.email().max(250).optional(),
  phoneNumber: z.string().trim().min(1).max(20).regex(phoneNumberFormat).optional(),
})

/**
 * La classe est portée par l'élève, pas par la fratrie.
 *
 * Une fiche familiale range couramment les enfants dans des classes différentes — « C4 /
 * C2 / F » sur une seule ligne. Une classe unique à la racine obligerait à découper la
 * famille en plusieurs appels, et chaque appel crée une famille : la fratrie ressortirait
 * en doublons.
 */
const mcpStudentSchema = mcpPersonSchema.extend({
  // Un jour de calendrier, pas un instant : un horodatage décalé (`+02:00`) tomberait la
  // veille en UTC, là où le tableau de bord range la même date à minuit UTC.
  birthday: z.iso.date().optional(),
  birthplace: z.string().trim().max(250).optional(),
  className: z.string().trim().min(1).max(250),
  // Même raison que la classe : une fiche mêle un grand élève à 90 et un petit à 180. Sans
  // libellé, l'élève prend la formule de la famille.
  planName: z.string().trim().min(1).max(50).optional(),
})

const paymentFields = {
  amount: z.number().refine((n) => n !== 0),
  method: mcpPaymentMethodSchema,
  reference: z.string().trim().max(250).optional(),
  paidAt: isoDate,
  cashedAt: isoDate.optional(),
}

const cashedAtOnlyForCheck = (data: { method: string; cashedAt?: string }) =>
  data.method === 'CHECK' || data.cashedAt === undefined

const mcpPaymentSchema = z.object(paymentFields).refine(cashedAtOnlyForCheck, {
  path: ['cashedAt'],
})

/**
 * Classe et formule sont attendues en **libellés**, pas en identifiants.
 *
 * Une fiche papier porte « C4 » et « Tarif fratrie » ; un identifiant est exactement ce
 * qu'un modèle de vision fabrique. La résolution est le travail du `preview_*`, et son
 * échec est un `blocker` nommé, corrigeable sans redeviner tout le formulaire.
 *
 * `familyId` fait exception : il ne se lit pas sur la fiche, il revient d'un `matches`
 * ou d'un `preview_record_payment`, et rattache les élèves à une famille déjà saisie.
 */
export const previewEnrollFamilySchema = z
  .object({
    familyId: z.uuid().optional(),
    familyName: z.string().trim().min(1).max(50).optional(),
    emergencyContactName: z.string().trim().max(250).optional(),
    emergencyContactPhone: z.string().trim().min(1).max(20).regex(phoneNumberFormat).optional(),
    parents: z.array(mcpParentSchema).max(4).default([]),
    students: z.array(mcpStudentSchema).min(1).max(10),
    planName: z.string().trim().min(1).max(50).optional(),
    discount: z.number().min(0).default(0),
    payment: mcpPaymentSchema.optional(),
  })
  .refine((data) => (data.familyId === undefined) !== (data.familyName === undefined))
  // Une famille existante garde ses parents et ses contacts : les rattacher ici créerait
  // en silence un second parent homonyme, que le dashboard sait mettre à jour.
  .refine(
    (data) =>
      data.familyId === undefined ||
      (data.parents.length === 0 &&
        data.emergencyContactName === undefined &&
        data.emergencyContactPhone === undefined)
  )

/**
 * Seule la famille est exigée, désignée par son identifiant, son nom ou l'un de ses élèves.
 *
 * Le reste a une valeur par défaut appliquée par le use case — tout le solde restant, en
 * espèces, daté du jour — et que le preview rend résolue : l'humain valide un encaissement
 * complet au lieu de répondre à une question par champ.
 */
export const previewRecordPaymentSchema = z
  .object({
    familyId: z.uuid().optional(),
    familyName: z.string().trim().min(1).max(50).optional(),
    studentId: z.uuid().optional(),
    amount: paymentFields.amount.optional(),
    method: mcpPaymentMethodSchema.optional(),
    reference: paymentFields.reference,
    paidAt: isoDate.optional(),
    cashedAt: paymentFields.cashedAt,
  })
  .refine(
    (data) =>
      data.familyId !== undefined || data.familyName !== undefined || data.studentId !== undefined
  )
  .refine((data) => data.method === 'CHECK' || data.cashedAt === undefined, {
    path: ['cashedAt'],
  })

export const mcpFindStudentsSchema = z.object({
  query: z.string().trim().min(2).max(100),
  limit: z.number().int().min(1).max(MCP_STUDENT_SEARCH_MAX).optional(),
})

export const mcpFamilyPaymentsSchema = z.object({ familyId: z.uuid() })

export const mcpCancelPaymentsSchema = z.object({
  paymentIds: z.array(z.uuid()).min(1).max(10),
})

/**
 * L'inscription se désigne par son identifiant, ou par l'élève qu'elle concerne.
 *
 * Le nom suffit dans le cas courant — un élève n'a qu'une inscription ouverte — et un
 * homonyme ou une double inscription est un `blocker` qui rend les candidats, dont
 * l'identifiant à renvoyer. Formule et remise sont chacune facultatives, pas les deux.
 */
export const previewUpdateEnrollmentSchema = z
  .object({
    enrollmentId: z.uuid().optional(),
    studentName: z.string().trim().min(1).max(250).optional(),
    studentLastname: z.string().trim().min(1).max(250).optional(),
    planName: z.string().trim().min(1).max(50).optional(),
    discount: z.number().min(0).optional(),
    totalAmount: z.number().min(0).refine(isCurrencyAmount).optional(),
  })
  .refine(
    (data) =>
      data.enrollmentId !== undefined ||
      (data.studentName !== undefined && data.studentLastname !== undefined)
  )
  .refine(
    (data) =>
      data.planName !== undefined || data.discount !== undefined || data.totalAmount !== undefined
  )

export const commitDraftSchema = z.object({
  draftId: z.uuid(),
  checksum: z.string().length(MCP_DRAFT_CHECKSUM_LENGTH),
})

/**
 * Un événement se stocke en heure murale de l'école, exprimée en UTC (`src/lib/date.ts`) :
 * un horodatage avec décalage (`+02:00`) serait un instant, pas une heure lue sur une
 * affiche, et déplacerait la réunion. Seuls le jour et l'heure sans fuseau sont admis.
 *
 * Pas de `status` : un événement dicté naît brouillon et se publie depuis le tableau de
 * bord, après relecture humaine, comme un plan d'inscription avant son commit.
 */
const eventWallClock = z.union([z.iso.date(), z.iso.datetime({ local: true })])

export const mcpCreateEventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(280).optional(),
  description: z.string().trim().max(5000).optional(),
  category: z.enum(EVENT_CATEGORIES),
  visibility: z.enum(EVENT_VISIBILITIES).optional(),
  allDay: z.boolean().optional(),
  startAt: eventWallClock,
  endAt: eventWallClock.optional(),
  location: z.string().trim().max(250).optional(),
  announceDaysBefore: z.number().int().nonnegative().optional(),
})

export const MCP_EVENT_LIST_DEFAULT = 50
export const MCP_EVENT_LIST_MAX = 100

export const mcpListEventsSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  status: z.enum(EVENT_STATUSES).optional(),
  limit: z.number().int().min(1).max(MCP_EVENT_LIST_MAX).optional(),
})

export const mcpEventIdSchema = z.object({ id: z.uuid() })

/**
 * Toujours sans `status` : la publication reste une action humaine du tableau de bord. Un
 * `null` efface un champ facultatif, une clé absente le laisse tel quel.
 */
export const mcpUpdateEventSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(120).optional(),
  summary: z.string().trim().max(280).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  category: z.enum(EVENT_CATEGORIES).optional(),
  visibility: z.enum(EVENT_VISIBILITIES).optional(),
  allDay: z.boolean().optional(),
  startAt: eventWallClock.optional(),
  endAt: eventWallClock.nullable().optional(),
  location: z.string().trim().max(250).nullable().optional(),
  announceDaysBefore: z.number().int().nonnegative().nullable().optional(),
})

export const mcpDuplicateEventSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(120),
})

export const MCP_ATTENDANCE_RANGE_MAX_DAYS = 31

export const mcpListAttendanceCallsSchema = z.object({
  periodId: z.uuid(),
  from: z.iso.date(),
  to: z.iso.date().optional(),
  classPeriodId: z.uuid().optional(),
})

export const mcpListClassScheduleSlotsSchema = z.object({ periodId: z.uuid() })
export const mcpCreateClassScheduleSlotSchema = createClassScheduleSlotSchema.omit({
  schoolId: true,
})
export const mcpUpdateClassScheduleSlotSchema = updateClassScheduleSlotSchema.omit({
  schoolId: true,
  classPeriodId: true,
})
export const mcpDeleteClassScheduleSlotSchema = deleteClassScheduleSlotSchema.omit({
  schoolId: true,
})

export const MCP_CLASS_SCHEDULE_BATCH_MAX = 100

/**
 * Un planning se dicte en **libellés**, comme une fiche d'inscription : « C4, samedi 9h-12h,
 * Mme Ali ». Classe et enseignants se résolvent au `preview_*`, où un libellé inconnu ou
 * ambigu est un `blocker` qui nomme la ligne (`slots.3.className`). Seule la période vient
 * en identifiant : elle ne se lit pas sur le planning, elle revient de `list_periods`.
 *
 * `teacherNames` désigne des enseignants déjà affectés à la classe, en prénom, nom ou
 * les deux — même règle que `teacherIds` sur les outils unitaires.
 */
const mcpClassScheduleSlotLabelSchema = z.object({
  className: z.string().trim().min(1).max(250),
  weekday: createClassScheduleSlotSchema.shape.weekday,
  startTime: createClassScheduleSlotSchema.shape.startTime,
  endTime: createClassScheduleSlotSchema.shape.endTime,
  description: createClassScheduleSlotSchema.shape.description,
  teacherNames: z.array(z.string().trim().min(1).max(250)).max(10).default([]),
})

export const previewClassScheduleSchema = z.object({
  periodId: z.uuid(),
  slots: z.array(mcpClassScheduleSlotLabelSchema).min(1).max(MCP_CLASS_SCHEDULE_BATCH_MAX),
})

export const mcpCreateTeacherSchema = z.object({
  firstName: z.string().trim().min(1).max(250),
  lastName: z.string().trim().max(250).default(''),
  email: z.email().optional(),
  phone: z.string().trim().max(20).optional(),
  // Deux enseignants homonymes existent : le second se crée en le disant, jamais par défaut.
  allowDuplicate: z.boolean().optional(),
})

/**
 * Une note de dépense lue sur un ticket. L'enseignant vient en libellé (`teacherName`) ou
 * en identifiant (`teacherId`), jamais les deux. Les dates sont des jours de calendrier,
 * rangés à minuit UTC comme le formulaire du tableau de bord.
 */
export const previewRecordTeacherExpenseSchema = z
  .object({
    teacherId: z.uuid().optional(),
    teacherName: z.string().trim().min(1).max(250).optional(),
    amount: z.number().positive().max(99_999_999.99).refine(isCurrencyAmount),
    category: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(250),
    requestedAt: z.iso.date().optional(),
    paidAt: z.iso.date().optional(),
  })
  .refine((data) => (data.teacherId === undefined) !== (data.teacherName === undefined), {
    message: 'teacherId or teacherName, exactly one',
    path: ['teacherId'],
  })

export const mcpAssignTeacherSchema = z.object({
  classPeriodId: z.string().uuid(),
  teacherId: z.string().uuid(),
})
