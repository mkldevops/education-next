import type { z } from 'zod'
import { checkCircularReference } from '@/domain/level'
import { levelGateway } from '@/gateways/level-gateway'
import { setNextLevelSchema } from './schemas'

type Input = z.infer<typeof setNextLevelSchema>

export async function setNextLevel(input: Input, levelGw = levelGateway) {
  const parsed = setNextLevelSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const level = await levelGw.findById(parsed.data.id)
  if (!level) return 'notFound' as const

  if (parsed.data.nextLevelId !== null) {
    const nextLevel = await levelGw.findById(parsed.data.nextLevelId)
    if (!nextLevel) return 'notFound' as const

    const alreadyLinked = await levelGw.findByNextLevelId(parsed.data.nextLevelId)
    if (alreadyLinked && alreadyLinked.id !== parsed.data.id) return 'alreadyLinked' as const

    const allLevels = await levelGw.list()
    const nextLevelMap = new Map(allLevels.map((l) => [l.id, l.nextLevelId]))
    nextLevelMap.set(parsed.data.id, parsed.data.nextLevelId)

    const circularCheck = checkCircularReference(
      parsed.data.id,
      parsed.data.nextLevelId,
      (id) => nextLevelMap.get(id) ?? null
    )
    if (circularCheck !== 'OK') return circularCheck
  }

  await levelGw.setNextLevel(parsed.data.id, parsed.data.nextLevelId)
  return 'OK' as const
}
