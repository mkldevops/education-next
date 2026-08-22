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
    })

    if (existing) {
      return db.config.update({
        where: { schoolId_name: { schoolId, name: data.name } },
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
