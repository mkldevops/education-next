import { z } from 'zod'
import type { DraftScope } from '@/use-cases/mcp/draft-scope'
import {
  familyReceiptsSchema,
  getMealSettingsFromMcp,
  getStudentMealsFromMcp,
  listFamilyReceiptsFromMcp,
  studentMealsSchema,
} from '@/use-cases/mcp/meal-reads'
import { changeMealSchedule } from '@/use-cases/meals/change-meal-schedule'
import { recordMealOpening } from '@/use-cases/meals/record-meal-opening'
import { removeMealPrice } from '@/use-cases/meals/remove-meal-price'
import {
  changeMealScheduleSchema,
  recordMealOpeningSchema,
  removeMealPriceSchema,
  setMealPriceSchema,
  setMealServiceSettingSchema,
  stopMealSchema,
  subscribeMealSchema,
  toggleMealAbsenceSchema,
} from '@/use-cases/meals/schemas'
import { setMealPrice } from '@/use-cases/meals/set-meal-price'
import { setMealServiceSetting } from '@/use-cases/meals/set-meal-service-setting'
import { stopMeal } from '@/use-cases/meals/stop-meal'
import { subscribeMeal } from '@/use-cases/meals/subscribe-meal'
import { toggleMealAbsence } from '@/use-cases/meals/toggle-meal-absence'
import { cancelReceipt } from '@/use-cases/receipts/cancel-receipt'
import { recordReceipt } from '@/use-cases/receipts/record-receipt'
import { cancelReceiptSchema, recordReceiptSchema } from '@/use-cases/receipts/schemas'
import type { SchoolTool } from './school-tools'

const read = { readOnlyHint: true, openWorldHint: false }
const write = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
}
const overwrite = { ...write, destructiveHint: true, idempotentHint: true }

/** Validate even direct catalog callers, strip unknown arguments, and adapt domain OK. */
function tool<S extends z.ZodObject>(
  name: string,
  title: string,
  description: string,
  inputSchema: S,
  annotations: NonNullable<SchoolTool['annotations']>,
  run: (args: z.infer<S>) => Promise<unknown>
): SchoolTool {
  return {
    name,
    title,
    description,
    inputSchema,
    annotations,
    kind: annotations.readOnlyHint ? 'read' : 'write',
    run: async (input) => {
      const parsed = inputSchema.safeParse(input)
      if (!parsed.success) return 'validationError'
      const result = await run(parsed.data)
      return result === 'OK' ? { success: true } : result
    },
  }
}

/** Published even when meals are off: existing use cases enforce the live feature gate. */
export function listMealTools(scope: DraftScope): SchoolTool[] {
  const school = { schoolId: scope.schoolId }
  const actor = { ...school, recordedById: scope.userId }
  return [
    tool(
      'get_meal_settings',
      'Configuration des repas',
      'Services CANTEEN et SNACK, jours autorisés ISO (1 lundi … 7 dimanche) et tarifs datés. Refus mealsDisabled.',
      z.object({}),
      read,
      () => getMealSettingsFromMcp(scope)
    ),
    tool(
      'get_student_meals',
      'Fiche repas d’un élève',
      'Comptes, segments, prix du jour, reprise, couverture et calendrier paid/due/unpaid/absent/closed. studentId vient de find_students. from/to inclus, 93 jours maximum ; défaut : 31 jours depuis le début du mois courant. coverage.paidThrough est expectedPaidThrough pour record_receipt. Refus mealsDisabled, notFound, invalidDateRange, rangeTooLong.',
      studentMealsSchema,
      read,
      (args) => getStudentMealsFromMcp(scope, args)
    ),
    tool(
      'list_family_receipts',
      'Reçus d’une famille',
      'Derniers reçus numérotés, lignes cantine/goûter, annulations incluses ; limit 50 par défaut, 100 maximum, hasMore signale une liste tronquée. familyId vient de find_students ou get_family_payments. Refus mealsDisabled, notFound.',
      familyReceiptsSchema,
      read,
      (args) => listFamilyReceiptsFromMcp(scope, args)
    ),
    tool(
      'set_meal_service_setting',
      'Configurer un service repas',
      'Active ou désactive CANTEEN/SNACK et remplace allowedWeekdays (ISO 1–7, non vides, sans doublon). Consulter get_meal_settings avant modification. Refus mealsDisabled, invalidWeekdays.',
      setMealServiceSettingSchema.omit({ schoolId: true }),
      overwrite,
      (args) => setMealServiceSetting({ ...args, ...school })
    ),
    tool(
      'set_meal_price',
      'Définir un tarif repas',
      'Prix journalier amount dans la devise de l’école, effectif à effectiveFrom YYYY-MM-DD. Même date : remplace le montant. Seul le premier tarif peut commencer dans le passé. Refus mealsDisabled, backdated, validationError.',
      setMealPriceSchema.omit({ schoolId: true }),
      overwrite,
      (args) => setMealPrice({ ...args, ...school })
    ),
    tool(
      'remove_meal_price',
      'Retirer un tarif futur',
      'Supprime le tarif id de get_meal_settings seulement avant sa prise d’effet. Refus mealsDisabled, notFound, alreadyEffective.',
      removeMealPriceSchema.omit({ schoolId: true }),
      { ...write, destructiveHint: true },
      (args) => removeMealPrice({ ...args, ...school })
    ),
    tool(
      'subscribe_meal',
      'Inscrire aux repas',
      'Ouvre un segment pour studentId, service, periodId de list_periods, weekdays ISO et startOn dans la période, passé inclus. Refus mealsDisabled, serviceDisabled, invalidWeekdays, outsidePeriod, alreadySubscribed, notFound.',
      subscribeMealSchema.omit({ schoolId: true, teacherId: true }).required({ studentId: true }),
      write,
      (args) => subscribeMeal({ ...args, ...school })
    ),
    tool(
      'subscribe_staff_meal',
      'Inscrire un enseignant à la cantine',
      'Ouvre un segment pour teacherId de list_teachers (le personnel est enregistré comme enseignant), service, periodId de list_periods, weekdays ISO et startOn dans la période. Facturé au tarif élève sauf exemption. Refus mealsDisabled, serviceDisabled, invalidWeekdays, outsidePeriod, alreadySubscribed, notFound.',
      subscribeMealSchema.omit({ schoolId: true, studentId: true }).required({ teacherId: true }),
      write,
      (args) => subscribeMeal({ ...args, ...school })
    ),
    tool(
      'change_meal_schedule',
      'Changer les jours de repas',
      'Remplace le rythme weekdays à effectiveFrom, aujourd’hui ou après dans le fuseau de l’école. Relire get_student_meals. Refus mealsDisabled, backdated, notSubscribed, invalidWeekdays.',
      changeMealScheduleSchema
        .omit({ schoolId: true, teacherId: true })
        .required({ studentId: true }),
      { ...write, destructiveHint: true },
      (args) => changeMealSchedule({ ...args, ...school })
    ),
    tool(
      'stop_meal',
      'Arrêter les repas',
      'Arrête le service de studentId à effectiveFrom, aujourd’hui ou après ; ferme ou retire ses segments futurs. Refus mealsDisabled, backdated, notSubscribed.',
      stopMealSchema.omit({ schoolId: true, teacherId: true }).required({ studentId: true }),
      { ...write, destructiveHint: true },
      (args) => stopMeal({ ...args, ...school })
    ),
    tool(
      'record_meal_opening',
      'Reprendre un solde repas historique',
      'Enregistre le déjà payé jusqu’à paidThrough avec reason obligatoire, en jours servis connus (segments et fermetures publiées). Remplace la reprise existante. Ne crée aucun reçu ni encaissement historique. Refus mealsDisabled, notSubscribed.',
      recordMealOpeningSchema
        .omit({ schoolId: true, teacherId: true, recordedById: true })
        .required({ studentId: true }),
      overwrite,
      (args) => recordMealOpening({ ...args, ...actor })
    ),
    tool(
      'toggle_meal_absence',
      'Saisir une absence repas',
      'Pose absent=true ou retire absent=false pour day YYYY-MM-DD sur un jour prévu ouvert, passé ou futur. La couverture se recalcule. Idempotent. Refus mealsDisabled, notSubscribed, notServed.',
      toggleMealAbsenceSchema
        .omit({ schoolId: true, teacherId: true, recordedById: true })
        .required({ studentId: true }),
      overwrite,
      (args) => toggleMealAbsence({ ...args, ...actor })
    ),
    tool(
      'record_receipt',
      'Encaisser un reçu de caisse',
      'Crée un reçu réel AUJOURD’HUI au tarif du jour, jamais antidaté. meals contient studentId, service, amount et expectedPaidThrough (coverage.paidThrough relu dans get_student_meals, null si aucun). tuition=0 pour un reçu repas seul ; tuition est réparti sur les inscriptions de la famille, ou porté en entier sur tuitionEnrollmentId (inscription payable de la famille, refus enrollmentNotPayable) ; aucune recette repas ne doit passer par record_payment. method CASH/MOBILE_MONEY/TRANSFER/CHECK. Conserver le même UUID idempotencyKey et contenu lors d’une reprise après coupure : même reçu ; contenu différent : idempotencyConflict. Relire après staleState. Reprise historique : record_meal_opening. Refus mealsDisabled, paymentsDisabled (écolage seulement), notInFamily, notSubscribed, noPrice, overpayment.',
      z.object(recordReceiptSchema.shape).omit({ schoolId: true, recordedById: true }),
      { ...write, idempotentHint: true },
      (args) => recordReceipt({ ...args, ...actor })
    ),
    tool(
      'cancel_receipt',
      'Annuler un reçu de caisse',
      'Annule receiptId de list_family_receipts, avec reason obligatoire : retire ses lignes repas du grand livre et annule son écolage. Conserve le reçu numéroté. Refus mealsDisabled, notFound, alreadyCancelled, refundExceedsPaid.',
      cancelReceiptSchema.omit({ schoolId: true, cancelledById: true }),
      { ...write, destructiveHint: true },
      (args) => cancelReceipt({ ...args, ...school, cancelledById: scope.userId })
    ),
  ]
}
