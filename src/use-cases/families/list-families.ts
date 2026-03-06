import { familyGateway } from '@/gateways/family-gateway'

export async function listFamilies() {
  return familyGateway.list()
}
