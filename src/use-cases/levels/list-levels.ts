import { levelGateway } from '@/gateways/level-gateway'

export async function listLevels() {
  return levelGateway.list()
}
