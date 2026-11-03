/** Titulaire d'un compte repas : un élève ou un membre du personnel, jamais les deux. */
export type MealOwner = { studentId: string } | { staffMemberId: string }

/** Le titulaire désigné par une saisie, ou `null` quand elle n'en nomme pas exactement un. */
export function mealOwner(input: { studentId?: string; staffMemberId?: string }): MealOwner | null {
  if (input.studentId && !input.staffMemberId) return { studentId: input.studentId }
  if (input.staffMemberId && !input.studentId) return { staffMemberId: input.staffMemberId }
  return null
}
