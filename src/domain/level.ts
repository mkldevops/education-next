/**
 * Refuse un lien de progression qui fermerait un cycle : la progression est un graphe orienté
 * sans cycle, où un niveau peut mener à plusieurs niveaux et suivre plusieurs niveaux.
 */
export function checkCircularReference(
  levelId: string,
  nextLevelIds: readonly string[],
  getNextLevelIds: (id: string) => readonly string[]
): 'OK' | 'circularReference' {
  const pending = [...nextLevelIds]
  const visited = new Set<string>()

  while (pending.length > 0) {
    const currentId = pending.pop() as string
    if (currentId === levelId) return 'circularReference'
    if (visited.has(currentId)) continue

    visited.add(currentId)
    pending.push(...getNextLevelIds(currentId))
  }

  return 'OK'
}
