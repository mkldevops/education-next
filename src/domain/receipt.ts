/** Numéro affiché d'un reçu : séquence par école, sur six chiffres au moins. */
export function formatReceiptNumber(number: number): string {
  return `R-${String(number).padStart(6, '0')}`
}

export type ReceiptRequest = {
  familyId: string
  method: string
  reference: string | null
  tuition: number
  tuitionEnrollmentId?: string
  meals: ReadonlyArray<{
    studentId: string
    service: string
    amount: number
    expectedPaidThrough: string | null
  }>
  childcare?: ReadonlyArray<{ chargeId: string; amount: number }>
}

/**
 * Forme canonique d'une demande d'encaissement, dont l'empreinte accompagne la clé
 * d'idempotence : un renvoi identique retrouve son reçu, un contenu différent sous la même
 * clé est refusé. Lignes triées et montants au centième, pour que l'ordre de saisie ou
 * l'écriture d'un nombre ne change pas l'empreinte. La garderie et l'inscription ciblée par
 * l'écolage n'y figurent que si le reçu en porte, pour que l'empreinte des reçus antérieurs reste
 * valable.
 */
export function canonicalReceiptRequest(request: ReceiptRequest): string {
  const cents = (value: number) => Math.round(value * 100)
  const childcare = [...(request.childcare ?? [])]
    .map((line) => ({ chargeId: line.chargeId, amount: cents(line.amount) }))
    .sort((a, b) => a.chargeId.localeCompare(b.chargeId))
  return JSON.stringify({
    familyId: request.familyId,
    method: request.method,
    reference: request.reference,
    tuition: cents(request.tuition),
    ...(request.tuitionEnrollmentId ? { tuitionEnrollmentId: request.tuitionEnrollmentId } : {}),
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
    ...(childcare.length > 0 ? { childcare } : {}),
  })
}

/** Total d'un reçu au centième : écolage, lignes repas et mois de garderie. */
export function receiptTotal(
  request: Pick<ReceiptRequest, 'tuition' | 'meals' | 'childcare'>
): number {
  const lines = [...request.meals, ...(request.childcare ?? [])]
  const cents =
    Math.round(request.tuition * 100) +
    lines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0)
  return cents / 100
}
