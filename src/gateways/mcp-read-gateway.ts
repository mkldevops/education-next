import { OPEN_ENROLLMENT_STATUSES } from '@/domain/enrollment'
import type { EventStatus } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'

/**
 * Projections publiées par les outils de lecture MCP, et seule frontière de ces lectures.
 *
 * Les gateways du dashboard lisent la ligne entière : une colonne ajoutée à `Teacher` y
 * entrerait sans qu'aucune relecture du MCP soit déclenchée, et partirait dans le contexte
 * du fournisseur de modèle. La surface exposée est donc décrite ici, `select` par outil,
 * plutôt que héritée d'une lecture écrite pour un écran.
 *
 * `email` et `phone` n'y figurent pas : un agent qui résout une fiche papier a besoin de
 * l'identité d'un enseignant, jamais de ses coordonnées.
 */
const teacherIdentity = { id: true, firstName: true, lastName: true } as const

const namedRef = { id: true, name: true } as const

// Aucune image : la route média sert une clé d'objet sans regarder visibilité ni statut,
// si bien qu'une `storageKey` publiée ouvrirait l'affiche d'un brouillon à quiconque la lit.
const eventSummary = {
  id: true,
  slug: true,
  title: true,
  category: true,
  visibility: true,
  status: true,
  allDay: true,
  startAt: true,
  endAt: true,
  location: true,
} as const

export type McpEventFilter = {
  from?: Date
  before?: Date
  status?: EventStatus
  take: number
}

export type McpAttendanceFilter = {
  periodId: string
  classPeriodId?: string
  from: Date
  before: Date
}

function attendanceClassScope({ periodId, classPeriodId }: McpAttendanceFilter) {
  return { isActive: true, periodId, ...(classPeriodId ? { id: classPeriodId } : {}) }
}

export const mcpReadGateway = {
  // `School` n'est pas couvert par le soft-delete de `src/lib/db.ts` : le filtre est explicite.
  describeSchool: (schoolId: string) =>
    db.school.findFirst({
      where: { id: schoolId, isActive: true },
      select: { id: true, name: true, slug: true },
    }),

  listLevels: async (schoolId: string) => {
    const levels = await db.level.findMany({
      where: { schoolId, isActive: true },
      // Les arêtes ne portent pas de filtre `isActive` : désactiver un niveau retire celles
      // qui le visent (`levelGateway.deactivate`), donc chaque cible publiée est active.
      select: { id: true, name: true, nextLevels: { select: { nextLevel: { select: namedRef } } } },
      orderBy: { name: 'asc' },
    })
    return levels.map(({ nextLevels, ...level }) => ({
      ...level,
      nextLevels: nextLevels.map(({ nextLevel }) => nextLevel),
    }))
  },

  listPeriods: (schoolId: string) =>
    db.period.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true, startAt: true, endAt: true },
      orderBy: { startAt: 'desc' },
    }),

  listClassPeriods: (schoolId: string) =>
    db.classPeriod.findMany({
      where: { schoolId, isActive: true },
      select: {
        id: true,
        name: true,
        capacity: true,
        // Même raison qu'au-dessus pour `level` et `period`, et même invariant tenu à
        // l'écriture : une désactivation est refusée tant qu'une classe les référence
        // (`levelInUse`, `periodInUse`).
        level: { select: namedRef },
        period: { select: namedRef },
        // La relation to-many, elle, filtre : l'extension soft-delete de `src/lib/db.ts`
        // ne couvre que la racine de la requête, et un enseignant désactivé garde sa ligne
        // `ClassPeriodTeacher`.
        teachers: {
          where: { teacher: { isActive: true } },
          select: { teacher: { select: teacherIdentity } },
        },
      },
      orderBy: { name: 'asc' },
    }),

  // La formule réservée « sans tarif » (FR-019) n'est jamais catalogable : un agent MCP
  // ne doit jamais pouvoir la proposer ni la sélectionner par nom.
  listPlans: (schoolId: string) =>
    db.plan.findMany({
      where: { schoolId, isActive: true, name: { not: UNPRICED_PLAN_NAME } },
      select: { id: true, name: true, amount: true, pricing: true, paymentSchedule: true },
      orderBy: { name: 'asc' },
    }),

  listTeachers: (schoolId: string) =>
    db.teacher.findMany({
      where: { schoolId, isActive: true },
      select: teacherIdentity,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),

  findTeacher: (schoolId: string, id: string) =>
    db.teacher.findFirst({ where: { id, schoolId, isActive: true }, select: teacherIdentity }),

  listEvents: (schoolId: string, filter: McpEventFilter) =>
    db.event.findMany({
      where: {
        schoolId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.from || filter.before
          ? {
              startAt: {
                ...(filter.from ? { gte: filter.from } : {}),
                ...(filter.before ? { lt: filter.before } : {}),
              },
            }
          : {}),
      },
      select: eventSummary,
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      take: filter.take,
    }),

  getEvent: (schoolId: string, id: string) =>
    db.event.findUnique({
      where: { id_schoolId: { id, schoolId } },
      select: { ...eventSummary, summary: true, description: true, announceDaysBefore: true },
    }),

  listClassScheduleSlots: (schoolId: string, periodId: string) =>
    db.classScheduleSlot.findMany({
      where: { schoolId, classPeriod: { periodId, isActive: true } },
      select: {
        id: true,
        weekday: true,
        startTime: true,
        endTime: true,
        description: true,
        classPeriod: { select: namedRef },
        teachers: {
          where: { teacher: { isActive: true } },
          select: { teacher: { select: teacherIdentity } },
        },
      },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    }),

  findPeriod: (schoolId: string, id: string) =>
    db.period.findFirst({ where: { id, schoolId, isActive: true }, select: { id: true } }),

  // Même périmètre que `/dashboard/attendance` : classes actives de la période, sans
  // présences ni élèves — l'état d'un appel suffit à savoir lequel relancer.
  listAttendanceSlots: (schoolId: string, filter: McpAttendanceFilter) =>
    db.classScheduleSlot.findMany({
      where: { schoolId, classPeriod: attendanceClassScope(filter) },
      select: {
        id: true,
        classPeriodId: true,
        weekday: true,
        startTime: true,
        endTime: true,
        classPeriod: { select: namedRef },
      },
      orderBy: [{ startTime: 'asc' }, { classPeriod: { name: 'asc' } }],
    }),

  listAttendanceSessions: (schoolId: string, filter: McpAttendanceFilter) =>
    db.attendanceSession.findMany({
      where: {
        schoolId,
        classPeriod: attendanceClassScope(filter),
        occurredOn: { gte: filter.from, lt: filter.before },
      },
      select: {
        id: true,
        classPeriodId: true,
        occurrenceKey: true,
        occurredOn: true,
        status: true,
        validatedAt: true,
        classPeriod: { select: namedRef },
      },
      orderBy: [{ occurredOn: 'asc' }, { classPeriod: { name: 'asc' } }],
    }),

  listAttendanceClosures: (schoolId: string, from: Date, before: Date) =>
    db.event.findMany({
      where: {
        schoolId,
        isActive: true,
        status: 'PUBLISHED',
        category: 'CLOSURE',
        startAt: { lt: before },
        OR: [{ endAt: null }, { endAt: { gte: from } }],
      },
      select: { status: true, category: true, startAt: true, endAt: true },
    }),

  // Identité, famille et inscription ouverte : de quoi désigner un élève dans un autre outil,
  // sans date de naissance, santé ni coordonnées.
  findStudents: (schoolId: string, query: string, take: number) =>
    db.student.findMany({
      where: {
        schoolId,
        person: {
          AND: query
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => ({
              OR: [
                { name: { contains: word, mode: 'insensitive' as const } },
                { lastname: { contains: word, mode: 'insensitive' as const } },
              ],
            })),
        },
      },
      select: {
        id: true,
        person: {
          select: {
            name: true,
            lastname: true,
            families: {
              where: { family: { isActive: true } },
              select: { family: { select: namedRef } },
            },
          },
        },
        enrollments: {
          where: { isActive: true, status: { in: [...OPEN_ENROLLMENT_STATUSES] } },
          select: {
            id: true,
            status: true,
            plan: { select: namedRef },
            classAssignments: {
              where: { endAt: null },
              select: { classPeriod: { select: namedRef } },
            },
          },
        },
      },
      orderBy: [{ person: { lastname: 'asc' } }, { person: { name: 'asc' } }],
      take,
    }),

  // `online` plutôt que l'identifiant de transaction : l'agent a besoin de savoir qu'un
  // paiement Stripe ne s'annule pas ici, pas de la référence du prestataire.
  listFamilyPayments: (schoolId: string, familyId: string, take: number) =>
    db.payment.findMany({
      where: { schoolId, familyId },
      select: {
        id: true,
        amount: true,
        method: true,
        reference: true,
        paidAt: true,
        cashedAt: true,
        paymentTransactionId: true,
        enrollment: {
          select: {
            id: true,
            student: { select: { person: { select: { name: true, lastname: true } } } },
          },
        },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      take,
    }),
}
