/** Titulaire d'un compte repas : un élève ou un membre du personnel, jamais les deux. */
export type MealOwner = { studentId: string } | { teacherId: string }

/** Le titulaire désigné par une saisie, ou `null` quand elle n'en nomme pas exactement un. */
export function mealOwner(input: { studentId?: string; teacherId?: string }): MealOwner | null {
  if (input.studentId && !input.teacherId) return { studentId: input.studentId }
  if (input.teacherId && !input.studentId) return { teacherId: input.teacherId }
  return null
}
