'use server'

import { revalidatePath } from 'next/cache'
import { resolveDebtorFamily } from '@/domain/family-debtor'
import { childcareGateway } from '@/gateways/childcare-gateway'
import { billChildcareMonth } from '@/use-cases/childcare/bill-childcare-month'
import { cancelChildcareCharge } from '@/use-cases/childcare/cancel-childcare-charge'
import { removeChildcareSubscription } from '@/use-cases/childcare/remove-childcare-subscription'
import { saveChildcareSubscription } from '@/use-cases/childcare/save-childcare-subscription'
import { attachStudentToFamily } from '@/use-cases/families/attach-student-to-family'
import { createFamilyForStudent } from '@/use-cases/families/create-family-for-student'
import { requireSchoolAdmin } from './auth-helper'

function revalidateChildcare() {
  revalidatePath('/dashboard/childcare')
  revalidatePath('/dashboard/cashier')
}

export async function saveChildcareSubscriptionAction(data: {
  studentId: string
  monthlyAmount: number
  startMonth: string
  endMonth: string | null
}) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await saveChildcareSubscription({ ...data, schoolId })
  if (result === 'OK') revalidateChildcare()
  return result
}

export async function removeChildcareSubscriptionAction(studentId: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await removeChildcareSubscription({ studentId, schoolId })
  if (result === 'OK') revalidateChildcare()
  return result
}

export async function billChildcareMonthAction(month: string) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const result = await billChildcareMonth({ month, schoolId, recordedById: userId })
  if (typeof result !== 'string') revalidateChildcare()
  return result
}

export async function cancelChildcareChargeAction(chargeId: string, reason: string) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const result = await cancelChildcareCharge({
    chargeId,
    reason,
    schoolId,
    cancelledById: userId,
  })
  if (result === 'OK') revalidateChildcare()
  return result
}

/** Élèves actifs à inscrire à la garderie, avec leur classe et leur famille redevable. */
export async function searchChildcareStudentsAction(query: string) {
  const { schoolId } = await requireSchoolAdmin()
  const trimmed = query.trim()
  if (trimmed.length < 2 || trimmed.length > 100) return []
  const students = await childcareGateway.searchStudents(schoolId, trimmed)
  return students.map((student) => ({
    id: student.id,
    name: `${student.person.name} ${student.person.lastname}`,
    className:
      student.enrollments.flatMap((enrollment) =>
        enrollment.classAssignments.map((assignment) => assignment.classPeriod.name)
      )[0] ?? null,
    familyName: resolveDebtorFamily(student.person.families)?.family.name ?? null,
    subscribed: student.childcareSubscriptions.length > 0,
  }))
}

export async function attachChildcareFamilyAction(studentId: string, familyId: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await attachStudentToFamily({ schoolId, studentId, familyId })
  if (result === 'OK') {
    revalidateChildcare()
    revalidatePath('/dashboard/families')
    revalidatePath(`/dashboard/families/${familyId}`)
    revalidatePath('/dashboard/payments')
  }
  return result
}

export async function createChildcareFamilyAction(
  studentId: string,
  data: { name: string; emergencyContactName?: string; emergencyContactPhone?: string }
) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const result = await createFamilyForStudent({
    name: data.name,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    schoolId,
    studentId,
    createdById: userId,
  })
  if (typeof result === 'string') return result
  revalidateChildcare()
  revalidatePath('/dashboard/families')
  revalidatePath('/dashboard/payments')
  return 'OK' as const
}
