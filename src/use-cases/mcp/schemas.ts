import { z } from 'zod'
import { MCP_DRAFT_CHECKSUM_LENGTH } from '@/domain/mcp-draft'
import { MCP_KEY_LIFETIMES_DAYS } from '@/domain/mcp-key'

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

const mcpPersonSchema = z.object({
  name: z.string().trim().min(1).max(250),
  lastname: z.string().trim().min(1).max(250),
  sex: z.enum(['MALE', 'FEMALE']),
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
  birthday: z.iso.date(),
  birthplace: z.string().trim().max(250).optional(),
  className: z.string().trim().min(1).max(250),
})

const mcpPaymentSchema = z
  .object({
    amount: z.number().refine((n) => n !== 0),
    method: z.enum(['CASH', 'CARD', 'TRANSFER', 'CHECK']),
    reference: z.string().trim().max(250).optional(),
    paidAt: isoDate,
    cashedAt: isoDate.optional(),
  })
  .refine((data) => data.method === 'CHECK' || data.cashedAt === undefined, {
    path: ['cashedAt'],
  })

/**
 * Classe et formule sont attendues en **libellés**, pas en identifiants.
 *
 * Une fiche papier porte « C4 » et « Tarif fratrie » ; un identifiant est exactement ce
 * qu'un modèle de vision fabrique. La résolution est le travail du `preview_*`, et son
 * échec est un `blocker` nommé, corrigeable sans redeviner tout le formulaire.
 */
export const previewEnrollFamilySchema = z.object({
  familyName: z.string().trim().min(1).max(50),
  emergencyContactName: z.string().trim().max(250).optional(),
  emergencyContactPhone: z.string().trim().min(1).max(20).regex(phoneNumberFormat).optional(),
  parents: z.array(mcpParentSchema).min(1).max(4),
  students: z.array(mcpStudentSchema).min(1).max(10),
  planName: z.string().trim().min(1).max(50),
  discount: z.number().min(0).default(0),
  payment: mcpPaymentSchema.optional(),
})

export const previewRecordPaymentSchema = z
  .object({
    familyId: z.uuid().optional(),
    familyName: z.string().trim().min(1).max(50).optional(),
    amount: z.number().refine((n) => n !== 0),
    method: z.enum(['CASH', 'CARD', 'TRANSFER', 'CHECK']),
    reference: z.string().trim().max(250).optional(),
    paidAt: isoDate,
    cashedAt: isoDate.optional(),
  })
  .refine((data) => data.familyId !== undefined || data.familyName !== undefined)
  .refine((data) => data.method === 'CHECK' || data.cashedAt === undefined, {
    path: ['cashedAt'],
  })

export const commitDraftSchema = z.object({
  draftId: z.uuid(),
  checksum: z.string().length(MCP_DRAFT_CHECKSUM_LENGTH),
})
