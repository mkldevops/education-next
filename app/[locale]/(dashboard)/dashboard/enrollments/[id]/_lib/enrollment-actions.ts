'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

export async function activateEnrollmentAction(enrollmentId: string): Promise<string> {
  try {
    await db.enrollment.update({
      where: { id: enrollmentId },
      data: { status: 'ACTIVE' },
    })
    revalidatePath('/dashboard/enrollments')
    return 'OK'
  } catch {
    return 'ERROR_UPDATE_FAILED'
  }
}

export async function cancelEnrollmentAction(enrollmentId: string): Promise<string> {
  try {
    await db.enrollment.update({
      where: { id: enrollmentId },
      data: { status: 'CANCELLED' },
    })
    revalidatePath('/dashboard/enrollments')
    return 'OK'
  } catch {
    return 'ERROR_UPDATE_FAILED'
  }
}

export async function completeEnrollmentAction(enrollmentId: string): Promise<string> {
  try {
    await db.enrollment.update({
      where: { id: enrollmentId },
      data: { status: 'COMPLETED' },
    })
    revalidatePath('/dashboard/enrollments')
    return 'OK'
  } catch {
    return 'ERROR_UPDATE_FAILED'
  }
}
