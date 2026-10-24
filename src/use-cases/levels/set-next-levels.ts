import type { z } from 'zod'
import { checkCircularReference } from '@/domain/level'
import { levelGateway } from '@/gateways/level-gateway'
import { setNextLevelsSchema } from './schemas'

type Input = z.infer<typeof setNextLevelsSchema>

/**
 * Remplace les niveaux suivants d'un niveau. Une liste vide le place en fin de progression.
 */
export async function setNextLevels(input: Input, levelGw = levelGateway) {
  const parsed = setNextLevelsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id } = parsed.data
  const nextLevelIds = [...new Set(parsed.data.nextLevelIds)]

  const level = await levelGw.findById(schoolId, id)
  if (!level) return 'notFound' as const

  if (nextLevelIds.length > 0) {
    // `findActiveByIds` est scopé par école : un niveau d'une autre école ou désactivé
    // manque à l'appel, même si la contrainte de la base l'interdit déjà.
    const nextLevels = await levelGw.findActiveByIds(schoolId, nextLevelIds)
    if (nextLevels.length !== nextLevelIds.length) return 'notFound' as const

    const nextLevelIdsByLevel = new Map<string, string[]>()
    for (const edge of await levelGw.listProgression(schoolId)) {
      if (edge.levelId === id) continue
      const targets = nextLevelIdsByLevel.get(edge.levelId) ?? []
      targets.push(edge.nextLevelId)
      nextLevelIdsByLevel.set(edge.levelId, targets)
    }

    const circularCheck = checkCircularReference(
      id,
      nextLevelIds,
      (levelId) => nextLevelIdsByLevel.get(levelId) ?? []
    )
    if (circularCheck !== 'OK') return circularCheck
  }

  await levelGw.setNextLevels(schoolId, id, nextLevelIds)
  return 'OK' as const
}
