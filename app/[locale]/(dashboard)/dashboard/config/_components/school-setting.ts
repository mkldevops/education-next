import type { ConfigValueType } from '@/generated/prisma/client'
import type { SchoolConfigKey } from '@/lib/school-config'

export type SchoolSetting = {
  name: SchoolConfigKey
  value: string
  valueType: ConfigValueType
}

/** Valeur enregistrée d'un réglage, ou sa valeur par défaut déjà résolue par la page. */
export function settingValue(settings: SchoolSetting[], name: SchoolConfigKey) {
  return settings.find((setting) => setting.name === name)?.value ?? ''
}
