import { levelGateway } from '@/gateways/level-gateway'

export async function listLevels(schoolId: string) {
  return levelGateway.list(schoolId)
}
