import type { MealStopPlan } from '@/domain/meal-schedule'
import type { MealService, Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

type Tx = Prisma.TransactionClient

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
      select: { status: true, category: true, startAt: true, endAt: true },
    }),

  /** Périodes des classes d'une inscription : celles dont l'annulation arrête les repas. */
  findEnrollmentPeriodIds: async (schoolId: string, enrollmentId: string) => {
    const rows = await db.classAssignment.findMany({
      where: { schoolId, enrollmentId },
      select: { classPeriod: { select: { periodId: true } } },
    })
    return [...new Set(rows.map((row) => row.classPeriod.periodId))]
  },

  /** Comptes, segments et ajustements d'un élève, pour sa fiche. */
  findStudentAccounts: async (schoolId: string, studentId: string) => {
    const accounts = await db.mealAccount.findMany({
      where: { schoolId, studentId },
      select: {
        id: true,
        service: true,
        schedules: { select: scheduleSelect, orderBy: { startOn: 'asc' } },
        adjustments: {
          select: { kind: true, days: true, reason: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    return accounts.map((account) => ({
      ...account,
      schedules: account.schedules.map(toScheduleRow),
    }))
  },
}
