import { familyGateway } from '@/gateways/family-gateway'

type Input = { id: string }

export async function deactivateFamily(input: Input) {
  const family = await familyGateway.findById(input.id)
  if (!family) return 'notFound' as const

  await familyGateway.deactivate(input.id)

  return 'OK' as const
}
