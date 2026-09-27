import type { ConfigValueType } from '@/generated/prisma/client'
import { db } from '@/lib/db'

type ConfigData = { name: string; value: string; valueType: ConfigValueType }
type ConfigClient = Pick<typeof db, 'config'>

async function upsertConfig(client: ConfigClient, schoolId: string, data: ConfigData) {
  const existing = await client.config.findFirst({
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
    return client.config.update({
      where: { id: existing.id, schoolId },
      data: { value: data.value, valueType: data.valueType },
    })
  }

  return client.config.create({ data: { ...data, schoolId } })
}

export const configGateway = {
  get: (schoolId: string, name: string) =>
    db.config.findFirst({
      where: { schoolId, name },
    }),

  set: (schoolId: string, data: ConfigData) => upsertConfig(db, schoolId, data),

  /** Toutes les lignes ou aucune : un nuancier à moitié écrit mélangerait deux thèmes. */
  setMany: (schoolId: string, entries: ConfigData[]) =>
    db.$transaction(async (tx) => {
      for (const data of entries) {
        await upsertConfig(tx, schoolId, data)
      }
    }),

  remove: (schoolId: string, name: string) =>
    db.config.deleteMany({
      where: { schoolId, name },
    }),

  list: (schoolId: string) =>
    db.config.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: 'asc' },
    }),
}
