'use server'

import { revalidatePath } from 'next/cache'
import { setSchoolCurrency } from '@/use-cases/schools/school-currency'
import { requireSchoolAdmin } from './auth-helper'

/**
 * Devise de l'école active : `schoolId` vient de la session, jamais du client. La revalidation
 * couvre le layout — les montants sont formatés dans toutes les pages du tableau de bord.
 */
export async function setSchoolCurrencyAction(currency: string) {
  const { schoolId } = await requireSchoolAdmin()

  const result = await setSchoolCurrency({ schoolId, currency })
  if (result !== 'OK') return result

  revalidatePath('/', 'layout')
  return 'OK' as const
}
