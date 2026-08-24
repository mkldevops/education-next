import type { ConfigValueType } from '@/generated/prisma/client'
import { db } from '@/lib/db'

export const configGateway = {
  get: (schoolId: string, name: string) =>
    db.config.findFirst({
      where: { schoolId, name },
    }),

  set: async (
    schoolId: string,
    data: { name: string; value: string; valueType: ConfigValueType }
  ) => {
    const existing = await db.config.findFirst({
      where: { schoolId, name: data.name },
      select: { id: true },
    })

    if (existing) {
      // Mise à jour par la clé primaire, pas par `schoolId_name` : ce dernier est un
      // unique **partiel** (`WHERE isActive = true`), donc Prisma émet un `WHERE`
      // sans le prédicat et une ligne archivée homonyme fait correspondre deux
      // lignes — « Expected zero or one element, got 2 ».
      // `schoolId` reste dans le `where` : il satisfait le garde tenant et ajoute
      // une défense en profondeur sur une ligne déjà résolue par école.
      return db.config.update({
        where: { id: existing.id, schoolId },
        data: { value: data.value, valueType: data.valueType },
      })
    }

    return db.config.create({ data: { ...data, schoolId } })
  },

  list: (schoolId: string) =>
    db.config.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: 'asc' },
    }),
}
