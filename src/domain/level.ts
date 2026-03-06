export function checkCircularReference(
  levelId: string,
  nextLevelId: string,
  getNextLevel: (id: string) => string | null
): 'OK' | 'circularReference' {
  if (levelId === nextLevelId) {
    return 'circularReference'
  }

  let currentId: string | null = nextLevelId
  const visited = new Set<string>()

  while (currentId !== null) {
    if (currentId === levelId) {
      return 'circularReference'
    }

    if (visited.has(currentId)) {
      break
    }

    visited.add(currentId)
    currentId = getNextLevel(currentId)
  }

  return 'OK'
}
