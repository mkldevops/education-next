import { billChildcareMonth } from '@/use-cases/childcare/bill-childcare-month'
import { cancelChildcareCharge } from '@/use-cases/childcare/cancel-childcare-charge'
import { recordChildcareOpening } from '@/use-cases/childcare/record-childcare-opening'
import { saveChildcareSubscription } from '@/use-cases/childcare/save-childcare-subscription'
import {
  billChildcareMonthSchema,
  cancelChildcareChargeSchema,
  recordChildcareOpeningSchema,
  saveChildcareSubscriptionSchema,
} from '@/use-cases/childcare/schemas'
import { getStudentChildcareFromMcp, studentChildcareSchema } from '@/use-cases/mcp/childcare-reads'
import type { DraftScope } from '@/use-cases/mcp/draft-scope'
import { overwrite, read, tool, write } from './catalog-tool'
import type { SchoolTool } from './school-tools'

/**
 * Garderie : publiée même repas éteints, comme les outils repas ; les use cases de l'écran
 * garderie refusent `mealsDisabled`. L'encaissement passe par `record_receipt`.
 */
export function listChildcareTools(scope: DraftScope): SchoolTool[] {
  const school = { schoolId: scope.schoolId }
  return [
    tool(
      'get_student_childcare',
      'Garderie d’un élève',
      'Garderie de studentId (find_students) : tarif mensuel, startMonth/endMonth YYYY-MM, reprise (opening.paidThrough), mois facturés avec chargeId, amount, paidByReceipts, settledByOpening, remaining et cancelled, totaux, et debtorFamilyId à passer comme familyId à record_receipt. subscription null sans garderie. currentMonth est le mois courant de l’école. Refus mealsDisabled, notFound (élève archivé ou inconnu).',
      studentChildcareSchema,
      read,
      (args) => getStudentChildcareFromMcp(scope, args)
    ),
    tool(
      'save_childcare_subscription',
      'Ouvrir ou modifier une garderie',
      'Crée ou remplace la garderie de studentId : monthlyAmount (tarif propre à l’enfant, dans la devise de l’école, jamais deviné), startMonth YYYY-MM explicite, endMonth YYYY-MM ou null. Le nouveau tarif vaut pour les mois pas encore facturés. Refus mealsDisabled, notFound (élève archivé ou inconnu), invalidPeriod (fin avant début), chargesOutsideRange (période excluant un mois facturé), validationError.',
      saveChildcareSubscriptionSchema.omit({ schoolId: true }),
      overwrite,
      (args) => saveChildcareSubscription({ ...args, ...school })
    ),
    tool(
      'bill_childcare_month',
      'Facturer un mois de garderie',
      'Facture month YYYY-MM pour TOUTES les garderies actives de l’école qui couvrent ce mois, au tarif courant figé. Rejouer ne facture rien deux fois ; un mois annulé repart au tarif courant. Rend billed, alreadyBilled, outsideRange. Refus mealsDisabled, futureMonth (fuseau de l’école).',
      billChildcareMonthSchema.omit({ schoolId: true, recordedById: true }),
      { ...write, idempotentHint: true },
      (args) => billChildcareMonth({ ...args, ...school, recordedById: scope.userId })
    ),
    tool(
      'record_childcare_opening',
      'Reprendre une garderie déjà réglée',
      'Pour une liste papier « à jour » : les mois de studentId jusqu’à paidThrough YYYY-MM inclus ne doivent plus rien, facturés avant ou après. reason obligatoire (source, ex. liste papier et date). Ne crée aucun reçu ni encaissement : un paiement reçu aujourd’hui passe par record_receipt. Remplace la reprise existante. Refus mealsDisabled, futureMonth, notFound, notSubscribed, invalidPeriod (avant startMonth).',
      recordChildcareOpeningSchema.omit({ schoolId: true, recordedById: true }),
      overwrite,
      (args) => recordChildcareOpening({ ...args, ...school, recordedById: scope.userId })
    ),
    tool(
      'cancel_childcare_charge',
      'Annuler un mois de garderie facturé',
      'Annule chargeId de get_student_childcare facturé par erreur, avec reason obligatoire ; la ligne reste. Refus mealsDisabled, notFound, alreadyCancelled, hasPayments (annuler d’abord le reçu avec cancel_receipt).',
      cancelChildcareChargeSchema.omit({ schoolId: true, cancelledById: true }),
      { ...write, destructiveHint: true },
      (args) => cancelChildcareCharge({ ...args, ...school, cancelledById: scope.userId })
    ),
  ]
}
