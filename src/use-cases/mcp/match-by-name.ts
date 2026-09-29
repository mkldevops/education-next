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

type NamedTeacher = { firstName: string; lastName: string }

/**
 * Un planning ou une note nomme un enseignant comme on le dit : « Mme Ali », « Fatima »,
 * « Ali Fatima ». L'égalité sur le nom complet dans un ordre ou l'autre, le prénom seul ou le
 * nom seul passe d'abord ; la sous-chaîne sur le nom complet ensuite, et deux candidats
 * restants sont une ambiguïté à rendre, pas à trancher.
 */
export function matchTeacher<T extends NamedTeacher>(rows: T[], label: string): T[] {
  const wanted = label.trim().toLowerCase()
  const exact = rows.filter((row) =>
    [
      `${row.firstName} ${row.lastName}`,
      `${row.lastName} ${row.firstName}`,
      row.firstName,
      row.lastName,
    ].some((name) => name.trim().toLowerCase() === wanted)
  )
  if (exact.length > 0) return exact
  return rows.filter((row) => `${row.firstName} ${row.lastName}`.toLowerCase().includes(wanted))
}
