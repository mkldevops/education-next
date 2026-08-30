import type { ConfigValueType } from '@/generated/prisma/client'
import { db } from '@/lib/db'

/**
 * Réglages de la plateforme entière. `PlatformSetting` ne porte pas de `schoolId` :
 * il est hors du garde tenant par construction, sans exception ni index partiel.
 */
export const platformSettingGateway = {
  get: (name: string) => db.platformSetting.findUnique({ where: { name } }),

  set: (data: { name: string; value: string; valueType: ConfigValueType }) =>
    db.platformSetting.upsert({
      where: { name: data.name },
      create: data,
      update: { value: data.value, valueType: data.valueType },
    }),
}
