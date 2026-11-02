import type { MealStopPlan } from '@/domain/meal-schedule'
import type { MealService, Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

type Tx = Prisma.TransactionClient
type Reader = Pick<Tx, 'mealAbsence' | 'mealAdjustment' | 'mealPayment' | 'mealPrice'>

/** Les dates `@db.Date` sont lues et écrites à minuit UTC. */
const toDbDate = (day: string) => new Date(`${day}T00:00:00.000Z`)
const toDay = (date: Date) => date.toISOString().slice(0, 10)

type MealScheduleRow = {
  id: string
  accountId: string
  periodId: string
  weekdays: number[]
  startOn: string
  endOn: string | null
  periodEnd: string
}

const scheduleSelect = {
  id: true,
  accountId: true,
  periodId: true,
  weekdays: true,
  startOn: true,
  endOn: true,
  period: { select: { endAt: true } },
} as const

function toScheduleRow(row: {
  id: string
  accountId: string
  periodId: string
  weekdays: number[]
  startOn: Date
  endOn: Date | null
  period: { endAt: Date }
}): MealScheduleRow {
  return {
    id: row.id,
    accountId: row.accountId,
    periodId: row.periodId,
    weekdays: row.weekdays,
    startOn: toDay(row.startOn),
    endOn: row.endOn ? toDay(row.endOn) : null,
    periodEnd: toDay(row.period.endAt),
  }
}

export const mealAccountGateway = {
  transaction: <T>(fn: (tx: Tx) => Promise<T>) => db.$transaction(fn),

  /**
   * Tient le compte d'un service jusqu'à la fin de `tx` : deux saisies sur les jours d'un
   * même enfant s'attendent au lieu de créer deux segments qui se chevauchent. `create`
   * ouvre le compte s'il n'existe pas encore. Rend son id, ou `null` sans compte.
   */
  lockAccount: async (
    tx: Tx,
    schoolId: string,
    studentId: string,
    service: MealService,
    create: boolean
  ) => {
    if (create) {
      await tx.$executeRaw`
        INSERT INTO "MealAccount" ("id", "schoolId", "studentId", "service", "updatedAt")
        VALUES (gen_random_uuid()::text, ${schoolId}, ${studentId}, ${service}::"MealService", now())
        ON CONFLICT ("schoolId", "studentId", "service") DO NOTHING`
    }
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "MealAccount"
      WHERE "schoolId" = ${schoolId} AND "studentId" = ${studentId}
        AND "service" = ${service}::"MealService"
      FOR NO KEY UPDATE`
    return rows[0]?.id ?? null
  },

  /** Tous les comptes d'un élève, dans un ordre fixe pour ne pas s'interbloquer. */
  lockStudentAccounts: async (tx: Tx, schoolId: string, studentId: string) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "MealAccount"
      WHERE "schoolId" = ${schoolId} AND "studentId" = ${studentId}
      ORDER BY "id"
      FOR NO KEY UPDATE`
    return rows.map((row) => row.id)
  },

  /**
   * Comptes d'un encaissement, tenus jusqu'à la fin de `tx` dans l'ordre des ids : deux
   * caisses qui rechargent les mêmes enfants s'attendent sans s'interbloquer. Tous les
   * comptes des élèves visés sont tenus, seuls ceux demandés sont rendus.
   */
  lockAccounts: async (
    tx: Tx,
    schoolId: string,
    keys: ReadonlyArray<{ studentId: string; service: MealService }>
  ) => {
    if (keys.length === 0) return []
    const studentIds = [...new Set(keys.map((key) => key.studentId))]
    const rows = await tx.$queryRaw<Array<{ id: string; studentId: string; service: MealService }>>`
      SELECT "id", "studentId", "service" FROM "MealAccount"
      WHERE "schoolId" = ${schoolId} AND "studentId" = ANY(${studentIds})
      ORDER BY "id"
      FOR NO KEY UPDATE`
    return rows.filter((row) =>
      keys.some((key) => key.studentId === row.studentId && key.service === row.service)
    )
  },

  /**
   * Grand livre de comptes : ajustements, puis lignes de reçus non annulés dans l'ordre
   * d'écriture (`summarizeMealAccount`).
   */
  listLedgers: async (client: Reader, schoolId: string, accountIds: string[]) => {
    const adjustments = await client.mealAdjustment.findMany({
      where: { schoolId, accountId: { in: accountIds } },
      select: { accountId: true, kind: true, days: true, reason: true },
      orderBy: { createdAt: 'asc' },
    })
    const payments = await client.mealPayment.findMany({
      where: { schoolId, accountId: { in: accountIds }, receipt: { cancelledAt: null } },
      select: { accountId: true, amount: true, unitPrice: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return {
      adjustments,
      payments: payments.map((payment) => ({
        accountId: payment.accountId,
        amount: Number(payment.amount),
        unitPrice: Number(payment.unitPrice),
      })),
    }
  },

  /** Jours servis que l'enfant n'a pas mangés (R7), par compte. */
  listAbsences: async (client: Reader, schoolId: string, accountIds: string[]) => {
    const rows = await client.mealAbsence.findMany({
      where: { schoolId, accountId: { in: accountIds } },
      select: { accountId: true, date: true },
    })
    return rows.map((row) => ({ accountId: row.accountId, day: toDay(row.date) }))
  },

  /**
   * Idempotent : marquer deux fois le même jour ne crée qu'une absence. Saisie à la main, elle
   * reprend une absence posée par les appels, qu'un appel corrigé ne retire alors plus.
   */
  addAbsence: async (
    tx: Tx,
    schoolId: string,
    data: { accountId: string; day: string; recordedById: string }
  ) => {
    await tx.mealAbsence.createMany({
      data: {
        schoolId,
        accountId: data.accountId,
        date: toDbDate(data.day),
        recordedById: data.recordedById,
      },
      skipDuplicates: true,
    })
    await tx.mealAbsence.updateMany({
      where: {
        schoolId,
        accountId: data.accountId,
        date: toDbDate(data.day),
        fromAttendance: true,
      },
      data: { fromAttendance: false, recordedById: data.recordedById },
    })
  },

  /** Une absence déjà saisie à la main reste la sienne. */
  addAttendanceAbsence: (
    tx: Tx,
    schoolId: string,
    data: { accountId: string; day: string; recordedById: string }
  ) =>
    tx.mealAbsence.createMany({
      data: {
        schoolId,
        accountId: data.accountId,
        date: toDbDate(data.day),
        recordedById: data.recordedById,
        fromAttendance: true,
      },
      skipDuplicates: true,
    }),

  removeAttendanceAbsence: (tx: Tx, schoolId: string, accountId: string, day: string) =>
    tx.mealAbsence.deleteMany({
      where: { schoolId, accountId, date: toDbDate(day), fromAttendance: true },
    }),

  /** Jour d'un appel et ses élèves, ou `null` pour un appel inconnu de l'école. */
  findSessionDay: async (schoolId: string, sessionId: string) => {
    const session = await db.attendanceSession.findUnique({
      where: { id_schoolId: { id: sessionId, schoolId } },
      select: { occurredOn: true, entries: { select: { studentId: true } } },
    })
    if (!session) return null
    return {
      day: toDay(session.occurredOn),
      studentIds: session.entries.map((entry) => entry.studentId),
    }
  },

  /** Pointages des appels validés d'un jour, lus sous le verrou des comptes. */
  listValidatedEntries: (tx: Tx, schoolId: string, day: string, studentIds: string[]) =>
    tx.attendanceEntry.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        attendanceSession: { occurredOn: toDbDate(day), status: 'VALIDATED' },
      },
      select: { studentId: true, status: true },
    }),

  removeAbsence: (tx: Tx, schoolId: string, accountId: string, day: string) =>
    tx.mealAbsence.deleteMany({ where: { schoolId, accountId, date: toDbDate(day) } }),

  listPrices: async (client: Reader, schoolId: string) => {
    const rows = await client.mealPrice.findMany({
      where: { schoolId },
      select: { service: true, amount: true, effectiveFrom: true },
    })
    return rows.map((row) => ({
      service: row.service,
      amount: Number(row.amount),
      effectiveFrom: toDay(row.effectiveFrom),
    }))
  },

  listSegments: async (
    client: Tx,
    schoolId: string,
    accountIds: string[],
    periodIds?: string[]
  ) => {
    const rows = await client.mealSchedule.findMany({
      where: {
        schoolId,
        accountId: { in: accountIds },
        ...(periodIds ? { periodId: { in: periodIds } } : {}),
      },
      select: scheduleSelect,
      orderBy: { startOn: 'asc' },
    })
    return rows.map(toScheduleRow)
  },

  createSegment: (
    tx: Tx,
    schoolId: string,
    data: {
      accountId: string
      periodId: string
      weekdays: number[]
      startOn: string
      endOn: string | null
    }
  ) =>
    tx.mealSchedule.create({
      data: {
        ...data,
        schoolId,
        startOn: toDbDate(data.startOn),
        endOn: data.endOn === null ? null : toDbDate(data.endOn),
      },
    }),

  applyStop: async (tx: Tx, schoolId: string, plan: MealStopPlan) => {
    if (plan.removed.length > 0) {
      await tx.mealSchedule.deleteMany({ where: { schoolId, id: { in: plan.removed } } })
    }
    for (const { id, endOn } of plan.closed) {
      await tx.mealSchedule.update({
        where: { id_schoolId: { id, schoolId } },
        data: { endOn: toDbDate(endOn) },
      })
    }
  },

  /** Une seule reprise par compte : la saisir à nouveau la remplace. */
  replaceOpening: async (
    tx: Tx,
    schoolId: string,
    data: { accountId: string; days: number; reason: string; recordedById: string }
  ) => {
    await tx.mealAdjustment.deleteMany({
      where: { schoolId, accountId: data.accountId, kind: 'OPENING' },
    })
    return tx.mealAdjustment.create({ data: { ...data, schoolId, kind: 'OPENING' } })
  },

  isActiveStudent: async (schoolId: string, studentId: string) =>
    (await db.student.count({ where: { schoolId, id: studentId } })) === 1,

  findPeriod: async (schoolId: string, periodId: string) => {
    const period = await db.period.findFirst({
      where: { schoolId, id: periodId },
      select: { startAt: true, endAt: true },
    })
    return period ? { start: toDay(period.startAt), end: toDay(period.endAt) } : null
  },

  findSetting: (schoolId: string, service: MealService) =>
    db.mealServiceSetting.findUnique({
      where: { schoolId_service: { schoolId, service } },
      select: { isEnabled: true, allowedWeekdays: true },
    }),

  /** Fermetures et vacances publiées qui touchent `[from, to]` (R12). */
  findClosures: (schoolId: string, from: string, to: string) =>
    db.event.findMany({
      where: {
        schoolId,
        isActive: true,
        status: 'PUBLISHED',
        category: { in: ['CLOSURE', 'HOLIDAY'] },
        startAt: { lt: new Date(Date.parse(`${to}T00:00:00.000Z`) + 86_400_000) },
        OR: [{ endAt: null }, { endAt: { gte: toDbDate(from) } }],
      },
      select: { id: true, status: true, category: true, startAt: true, endAt: true },
    }),

  /** Périodes des classes d'une inscription : celles dont l'annulation arrête les repas. */
  findEnrollmentPeriodIds: async (schoolId: string, enrollmentId: string) => {
    const rows = await db.classAssignment.findMany({
      where: { schoolId, enrollmentId },
      select: { classPeriod: { select: { periodId: true } } },
    })
    return [...new Set(rows.map((row) => row.classPeriod.periodId))]
  },

  /** Comptes des élèves actifs de l'école, pour l'impact d'une fermeture. */
  findActiveStudentAccounts: (schoolId: string) =>
    db.mealAccount.findMany({
      where: { schoolId, student: { isActive: true } },
      select: { id: true, studentId: true, service: true },
    }),

  /** Comptes d'élèves et leurs segments, pour leur fiche ou la caisse. */
  findStudentAccounts: async (schoolId: string, studentIds: string[]) => {
    const accounts = await db.mealAccount.findMany({
      where: { schoolId, studentId: { in: studentIds } },
      select: {
        id: true,
        studentId: true,
        service: true,
        schedules: { select: scheduleSelect, orderBy: { startOn: 'asc' } },
      },
    })
    return accounts.map((account) => ({
      ...account,
      schedules: account.schedules.map(toScheduleRow),
    }))
  },

  /** Segments d'élèves actifs qui couvrent `day`, et leurs absences ce jour-là. */
  listStudentDay: async (schoolId: string, service: MealService, day: string) => {
    const date = toDbDate(day)
    const segments = await db.mealSchedule.findMany({
      where: {
        schoolId,
        startOn: { lte: date },
        OR: [{ endOn: null }, { endOn: { gte: date } }],
        account: { service, student: { isActive: true } },
      },
      select: {
        accountId: true,
        weekdays: true,
        startOn: true,
        endOn: true,
        period: { select: { endAt: true } },
      },
    })
    const absences = await db.mealAbsence.findMany({
      where: { schoolId, date, account: { service } },
      select: { accountId: true },
    })
    return {
      segments: segments.map((row) => ({
        accountId: row.accountId,
        weekdays: row.weekdays,
        startOn: toDay(row.startOn),
        endOn: row.endOn ? toDay(row.endOn) : null,
        periodEnd: toDay(row.period.endAt),
      })),
      absentAccountIds: new Set(absences.map((row) => row.accountId)),
    }
  },
}
