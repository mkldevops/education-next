import { z } from 'zod'
import { familyGateway } from '@/gateways/family-gateway'

const familyIdSchema = z.uuid()

/**
 * Famille choisie dans le chat : un simple indice venu du navigateur. Elle ne vaut que si
 * elle existe, active, dans l'école de la session ; sinon le tour continue sans elle.
 */
export async function findSelectedFamily(schoolId: string, raw: unknown, gateway = familyGateway) {
  const parsed = familyIdSchema.safeParse(raw)
  if (!parsed.success) return null

  const family = await gateway.findById(schoolId, parsed.data)
  if (!family?.isActive) return null
  return { id: family.id, name: family.name }
}
