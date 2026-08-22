import { familyGateway } from '@/gateways/family-gateway'

export async function listFamilies(schoolId: string) {
  return familyGateway.list(schoolId)
}
