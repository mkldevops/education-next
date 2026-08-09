export function toInitials(name: string): string {
  const letters = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => [...word][0])
    .filter((char) => /\p{L}/u.test(char))
    .slice(0, 2)
    .join('')

  return letters.toUpperCase() || '?'
}
