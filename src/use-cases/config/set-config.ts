import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { SCHOOL_CONFIG_VALUE_TYPES } from '@/lib/school-config'
import { setConfigSchema } from './schemas'

type Input = z.infer<typeof setConfigSchema>

// La valeur d'une couleur est injectée telle quelle dans le `<style>` du layout : sans
// format imposé, un administrateur d'école peut refermer la règle et écrire le CSS de son
// choix sur toutes les pages de son école.
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

function validateValueType(value: string, valueType: string): boolean {
  switch (valueType) {
    case 'NUMBER':
      return !Number.isNaN(Number(value))
    case 'BOOLEAN':
      return value === 'true' || value === 'false'
    case 'COLOR':
      return HEX_COLOR.test(value)
    default:
      return true
  }
}

export async function setConfig(input: Input, configGw = configGateway) {
  const parsed = setConfigSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, name, value } = parsed.data
  const valueType = SCHOOL_CONFIG_VALUE_TYPES[name]
  if (!validateValueType(value, valueType)) {
    return 'invalidConfigValue' as const
  }

  const config = await configGw.set(schoolId, { name, value, valueType })
  return config
}
