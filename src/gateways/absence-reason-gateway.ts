import { DEFAULT_ABSENCE_REASONS } from '@/domain/absence-reason'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

const REASON_SELECT = { id: true, label: true, justified: true, position: true } as const

export type AbsenceReasonRow = { id: string; label: string; justified: boolean; position: number }

export const absenceReasonGateway = {
  /** Active reasons in screen order. Archived ones stay readable on past calls via their snapshot. */
  listActive: (schoolId: string): Promise<AbsenceReasonRow[]> =>
    db.absenceReason.findMany({
      where: { schoolId },
      select: REASON_SELECT,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    }),

  findActive: (schoolId: string, id: string) =>
    db.absenceReason.findFirst({ where: { id, schoolId }, select: REASON_SELECT }),

  create: (schoolId: string, data: { label: string; justified: boolean; position: number }) =>
    db.absenceReason.create({ data: { ...data, schoolId }, select: REASON_SELECT }),

  update: async (schoolId: string, id: string, data: { label?: string; justified?: boolean }) =>
    (await db.absenceReason.updateMany({ where: { id, schoolId, isActive: true }, data })).count,

  archive: async (schoolId: string, id: string) =>
    (
      await db.absenceReason.updateMany({
        where: { id, schoolId, isActive: true },
        data: { isActive: false },
      })
    ).count,

  /** Positions follow the given order; every id must already be an active reason of the school. */
  reorder: (schoolId: string, ids: string[]) =>
    db.$transaction(
      ids.map((id, position) =>
        db.absenceReason.updateMany({ where: { id, schoolId, isActive: true }, data: { position } })
      )
    ),

  createDefaults: (tx: Prisma.TransactionClient, schoolId: string) =>
    tx.absenceReason.createMany({
      data: DEFAULT_ABSENCE_REASONS.map((reason, position) => ({ ...reason, position, schoolId })),
    }),
}
