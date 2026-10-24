import type { MealService } from '@/generated/prisma/client'
import { db } from '@/lib/db'

/** Les dates `@db.Date` sont lues et écrites à minuit UTC. */
const toDbDate = (day: string) => new Date(`${day}T00:00:00.000Z`)

export const mealGateway = {
  upsertSetting: (
    schoolId: string,
    service: MealService,
    data: { isEnabled: boolean; allowedWeekdays: number[] }
  ) =>
    db.mealServiceSetting.upsert({
      where: { schoolId_service: { schoolId, service } },
      create: { ...data, schoolId, service },
      update: data,
    }),

  countPrices: (schoolId: string, service: MealService) =>
    db.mealPrice.count({ where: { schoolId, service } }),

  /** Même date d'effet : le montant est corrigé plutôt que doublé. */
  upsertPrice: (schoolId: string, service: MealService, amount: number, effectiveFrom: string) =>
    db.mealPrice.upsert({
      where: {
        schoolId_service_effectiveFrom: {
          schoolId,
          service,
          effectiveFrom: toDbDate(effectiveFrom),
        },
      },
      create: { schoolId, service, amount, effectiveFrom: toDbDate(effectiveFrom) },
      update: { amount },
    }),

  findPrice: (schoolId: string, id: string) =>
    db.mealPrice.findUnique({ where: { id_schoolId: { id, schoolId } } }),

  deletePrice: (schoolId: string, id: string) =>
    db.mealPrice.delete({ where: { id_schoolId: { id, schoolId } } }),
}
