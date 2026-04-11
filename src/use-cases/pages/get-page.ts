import { pageGateway } from '@/gateways/page-gateway'

export async function getPage(id: string, gateway = pageGateway) {
  return gateway.getById(id)
}

export async function getPageBySlug(slug: string, gateway = pageGateway) {
  return gateway.getBySlug(slug)
}

export async function getHomePage(gateway = pageGateway) {
  return gateway.getHome()
}
