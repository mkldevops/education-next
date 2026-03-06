import { db } from '@/lib/db'

export const classAssignmentGateway = {
  create: (data: { enrollmentId: string; classPeriodId: string }) =>
    db.classAssignment.create({ data }),

  closeCurrent: (enrollmentId: string) =>
    db.classAssignment.updateMany({
      where: {
        enrollmentId,
        endAt: null,
      },
      data: { endAt: new Date() },
    }),

  findCurrent: (enrollmentId: string) =>
    db.classAssignment.findFirst({
      where: {
        enrollmentId,
        endAt: null,
      },
      include: { classPeriod: true },
    }),
}
