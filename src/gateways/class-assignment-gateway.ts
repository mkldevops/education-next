import { db } from '@/lib/db'

export const classAssignmentGateway = {
  closeCurrent: (schoolId: string, enrollmentId: string) =>
    db.classAssignment.updateMany({
      where: {
        schoolId,
        enrollmentId,
        endAt: null,
      },
      data: { endAt: new Date() },
    }),

  findCurrent: (schoolId: string, enrollmentId: string) =>
    db.classAssignment.findFirst({
      where: {
        schoolId,
        enrollmentId,
        endAt: null,
      },
      include: { classPeriod: true },
    }),
}
