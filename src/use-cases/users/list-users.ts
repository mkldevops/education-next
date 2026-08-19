import { userGateway } from '@/gateways/user-gateway'

export function listUsers() {
  return userGateway.listAll()
}
