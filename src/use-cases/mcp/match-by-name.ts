/**
 * Résolution d'un libellé lu sur papier. L'égalité insensible à la casse d'abord, puis
 * une seule passe par sous-chaîne : « C4 » doit atteindre « C4 — Arabe débutant », mais
 * deux candidats restants sont une ambiguïté à rendre à l'humain, pas à trancher.
 */
export function matchByName<T extends { name: string }>(rows: T[], label: string): T[] {
  const wanted = label.trim().toLowerCase()
  const exact = rows.filter((row) => row.name.trim().toLowerCase() === wanted)
  if (exact.length > 0) return exact
  return rows.filter((row) => row.name.toLowerCase().includes(wanted))
}
