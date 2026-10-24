/** Numéro affiché d'un reçu : séquence par école, sur six chiffres au moins. */
export function formatReceiptNumber(number: number): string {
  return `R-${String(number).padStart(6, '0')}`
}

export type ReceiptRequest = {
  familyId: string
  method: string
  reference: string | null
  tuition: number
  meals: ReadonlyArray<{
    studentId: string
    service: string
    amount: number
    expectedPaidThrough: string | null
  }>
}

/**
 * Forme canonique d'une demande d'encaissement, dont l'empreinte accompagne la clé
 * d'idempotence : un renvoi identique retrouve son reçu, un contenu différent sous la même
 * clé est refusé. Lignes triées et montants au centième, pour que l'ordre de saisie ou
 * l'écriture d'un nombre ne change pas l'empreinte.
 */
export function canonicalReceiptRequest(request: ReceiptRequest): string {
  const cents = (value: number) => Math.round(value * 100)
  return JSON.stringify({
    familyId: request.familyId,
    method: request.method,
    reference: request.reference,
    tuition: cents(request.tuition),
    meals: [...request.meals]
      .map((line) => ({
        studentId: line.studentId,
        service: line.service,
        amount: cents(line.amount),
        expectedPaidThrough: line.expectedPaidThrough,
      }))
      .sort((a, b) =>
        a.studentId === b.studentId
          ? a.service.localeCompare(b.service)
          : a.studentId.localeCompare(b.studentId)
      ),
  })
}

/** Total d'un reçu au centième : écolage et lignes repas. */
export function receiptTotal(request: Pick<ReceiptRequest, 'tuition' | 'meals'>): number {
  const cents =
    Math.round(request.tuition * 100) +
    request.meals.reduce((sum, line) => sum + Math.round(line.amount * 100), 0)
  return cents / 100
}
