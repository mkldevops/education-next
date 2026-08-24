import type { z } from 'zod'
import { checkCircularReference } from '@/domain/level'
import { levelGateway } from '@/gateways/level-gateway'
import { setNextLevelSchema } from './schemas'

type Input = z.infer<typeof setNextLevelSchema>

export async function setNextLevel(input: Input, levelGw = levelGateway) {
  const parsed = setNextLevelSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, nextLevelId } = parsed.data

  const level = await levelGw.findById(schoolId, id)
  if (!level) return 'notFound' as const

  if (nextLevelId !== null) {
    // `findById` est scopé par école : un niveau d'une autre école ne peut donc
    // jamais être résolu ici, même si la contrainte de la base l'interdit déjà.
    const nextLevel = await levelGw.findById(schoolId, nextLevelId)
    if (!nextLevel) return 'notFound' as const

    const alreadyLinked = await levelGw.findByNextLevelId(schoolId, nextLevelId)
    if (alreadyLinked && alreadyLinked.id !== id) return 'alreadyLinked' as const

    const allLevels = await levelGw.list(schoolId)
    const nextLevelMap = new Map(allLevels.map((l) => [l.id, l.nextLevelId]))
    nextLevelMap.set(id, nextLevelId)

    const circularCheck = checkCircularReference(
      id,
      nextLevelId,
      (levelId) => nextLevelMap.get(levelId) ?? null
    )
    if (circularCheck !== 'OK') return circularCheck
  }

  await levelGw.setNextLevel(schoolId, id, nextLevelId)
  return 'OK' as const
}
