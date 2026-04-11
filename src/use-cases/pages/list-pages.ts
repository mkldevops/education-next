import { pageGateway } from '@/gateways/page-gateway'

export async function listPages(gateway = pageGateway) {
  return gateway.list()
}
