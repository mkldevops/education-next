import { enrollmentBalances } from '@/domain/payment'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'

export type PayableEnrollmentChoice = {
  enrollmentId: string
  studentName: string
  remainingBalance: number
}

/**
 * Inscriptions qu'un encaissement d'écolage peut viser seul : celles que l'écriture relira sous
 * verrou (`findPayableByFamily`) et qui doivent encore de l'argent.
 */
export async function listPayableEnrollmentChoices(
  schoolId: string,
  familyId: string
): Promise<PayableEnrollmentChoice[]> {
  const enrollments = await enrollmentGateway.findPayableByFamily(schoolId, familyId)
  const balances = enrollmentBalances(enrollments)

  return enrollments.flatMap((enrollment, index) =>
    balances[index].remainingBalance > 0
      ? [
          {
            enrollmentId: enrollment.id,
            studentName: enrollment.studentName,
            remainingBalance: balances[index].remainingBalance,
          },
        ]
      : []
  )
}
