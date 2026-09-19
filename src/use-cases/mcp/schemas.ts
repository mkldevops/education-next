import { z } from 'zod'
import { isCurrencyAmount } from '@/domain/enrollment'
import { MCP_DRAFT_CHECKSUM_LENGTH } from '@/domain/mcp-draft'
import { MCP_KEY_LIFETIMES_DAYS } from '@/domain/mcp-key'
import { EVENT_CATEGORIES, EVENT_VISIBILITIES } from '@/use-cases/events/schemas'

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

export const previewRecordPaymentSchema = z
  .object({
    familyId: z.uuid().optional(),
    familyName: z.string().trim().min(1).max(50).optional(),
    ...paymentFields,
  })
  .refine((data) => data.familyId !== undefined || data.familyName !== undefined)
  .refine(cashedAtOnlyForCheck, { path: ['cashedAt'] })

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
