import type { ConfigValueType } from '@/generated/prisma/client'
import { db } from '@/lib/db'

export const configGateway = {
  get: (name: string) =>
    db.config.findFirst({
      where: { name },
    }),

  set: async (data: { name: string; value: string; valueType: ConfigValueType }) => {
    const existing = await db.config.findFirst({
      where: { name: data.name },
    })

    if (existing) {
      return db.config.update({
        where: { id: existing.id },
        data: { value: data.value, valueType: data.valueType },
      })
    }

    return db.config.create({ data })
  },

  list: () =>
    db.config.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
}
