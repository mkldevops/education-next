'use server'

import { revalidatePath } from 'next/cache'
import {
  deleteStripeSecret,
  setStripeEnabled,
  setStripeSecret,
} from '@/use-cases/payments/stripe-settings'
import { requireSchoolAdmin } from './auth-helper'

/**
 * Réglages de l'école active seulement : `schoolId` vient de la session, jamais du client.
 * La revalidation couvre le layout — le bouton de paiement parent est rendu hors de la page
 * de configuration.
 */
export async function setStripeEnabledAction(enabled: boolean) {
  const { schoolId } = await requireSchoolAdmin()

  const result = await setStripeEnabled({ schoolId, enabled })
  if (result !== 'OK') return result

  revalidatePath('/', 'layout')
  return 'OK' as const
}

/** Le secret descend une fois, à la saisie ; le retour n'est qu'un verdict. */
export async function setStripeSecretAction(kind: string, value: string) {
  const { schoolId } = await requireSchoolAdmin()

  const result = await setStripeSecret({ schoolId, kind, value })
  if (result !== 'OK') return result

  revalidatePath('/', 'layout')
  return 'OK' as const
}

export async function deleteStripeSecretAction(kind: string) {
  const { schoolId } = await requireSchoolAdmin()

  const result = await deleteStripeSecret({ schoolId, kind })
  if (result !== 'OK') return result

  revalidatePath('/', 'layout')
  return 'OK' as const
}
