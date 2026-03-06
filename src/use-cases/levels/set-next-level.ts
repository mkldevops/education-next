import type { z } from 'zod'
import { checkCircularReference } from '@/domain/level'
import { levelGateway } from '@/gateways/level-gateway'
import { setNextLevelSchema } from './schemas'

type Input = z.infer<typeof setNextLevelSchema>

export async function setNextLevel(input: Input) {
  const parsed = setNextLevelSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const level = await levelGateway.findById(parsed.data.id)
  if (!level) return 'notFound' as const

  if (parsed.data.nextLevelId !== null) {
    const nextLevel = await levelGateway.findById(parsed.data.nextLevelId)
    if (!nextLevel) return 'notFound' as const

    const allLevels = await levelGateway.list()
    const nextLevelMap = new Map(allLevels.map((l) => [l.id, l.nextLevelId]))
    nextLevelMap.set(parsed.data.id, parsed.data.nextLevelId)

    const circularCheck = checkCircularReference(
      parsed.data.id,
      parsed.data.nextLevelId,
      (id) => nextLevelMap.get(id) ?? null
    )
    if (circularCheck !== 'OK') return circularCheck
  }

  await levelGateway.setNextLevel(parsed.data.id, parsed.data.nextLevelId)
  return 'OK' as const
}
