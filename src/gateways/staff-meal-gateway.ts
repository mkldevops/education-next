import type { MealService } from '@/generated/prisma/client'
import { db } from '@/lib/db'

export const staffMealGateway = {
  isActiveTeacher: async (schoolId: string, teacherId: string) =>
    (await db.teacher.count({ where: { schoolId, id: teacherId, isActive: true } })) === 1,

  /** Une ligne par membre et service : la saisir à nouveau remplace ses jours. */
  upsert: (
    schoolId: string,
    teacherId: string,
    service: MealService,
    data: { weekdays: number[]; isFree: boolean }
  ) =>
    db.staffMeal.upsert({
      where: { schoolId_teacherId_service: { schoolId, teacherId, service } },
      create: { ...data, schoolId, teacherId, service },
      update: data,
    }),

  remove: async (schoolId: string, teacherId: string, service: MealService) =>
    (await db.staffMeal.deleteMany({ where: { schoolId, teacherId, service } })).count,

  /** Repas du personnel encore en poste, pour la page repas. */
  listActive: (schoolId: string) =>
    db.staffMeal.findMany({
      where: { schoolId, teacher: { isActive: true } },
      select: {
        teacherId: true,
        service: true,
        weekdays: true,
        isFree: true,
        teacher: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ teacher: { lastName: 'asc' } }, { teacher: { firstName: 'asc' } }],
    }),

  listActiveTeachers: (schoolId: string) =>
    db.teacher.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),

  /** Rythmes du personnel d'un service, pour l'effectif du jour. */
  listRhythms: (schoolId: string, service: MealService) =>
    db.staffMeal.findMany({
      where: { schoolId, service, teacher: { isActive: true } },
      select: { weekdays: true, isFree: true },
    }),
}
