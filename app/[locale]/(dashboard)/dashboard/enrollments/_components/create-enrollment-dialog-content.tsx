'use client'

import {
  Button,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useDialog,
} from '@peaklab/ui'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { RequiredMark } from '@/features/forms/required-mark'
import { Link, useRouter } from '@/i18n/routing'
import { currencyStep, currencySymbol } from '@/lib/decimal'
import { toast, toastActionError } from '@/lib/toast'
import { ClassSelect } from '../../../_components/class-select'
import {
  EnrollmentArrivalFields,
  useEnrollmentArrival,
} from '../../../_components/enrollment-arrival-fields'
import { arrivalPeriod } from '../../../_lib/arrival-schedule'
import { createEnrollmentAction } from '../../../_lib/enrollment-actions'
import type { CreateEnrollmentDialogProps } from './create-enrollment-dialog'
import { StudentCombobox } from './student-combobox'

/**
 * Contenu du dialogue d'inscription, chargé à la première ouverture : les sélecteurs guidés
 * (combobox, liste des classes) ne pèsent pas sur le chargement des pages qui l'affichent.
 */
export function CreateEnrollmentDialogContent({
  students,
  plans,
  classes,
  paymentsEnabled,
  currency,
  defaultStudentId,
  redirectTo,
  onAddStudent,
}: CreateEnrollmentFormProps) {
  const t = useTranslations('dashboard.pages.enrollments.create')

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
      </DialogHeader>
      <CreateEnrollmentForm
        students={students}
        plans={plans}
        classes={classes}
        paymentsEnabled={paymentsEnabled}
        currency={currency}
        defaultStudentId={defaultStudentId}
        redirectTo={redirectTo}
        onAddStudent={onAddStudent}
      />
    </DialogContent>
  )
}

type CreateEnrollmentFormProps = Pick<
  CreateEnrollmentDialogProps,
  | 'students'
  | 'plans'
  | 'classes'
  | 'paymentsEnabled'
  | 'currency'
  | 'defaultStudentId'
  | 'redirectTo'
  | 'onAddStudent'
>

function CreateEnrollmentForm({
  students,
  plans,
  classes,
  paymentsEnabled,
  currency,
  defaultStudentId,
  redirectTo,
  onAddStudent,
}: CreateEnrollmentFormProps) {
  const t = useTranslations('dashboard.pages.enrollments.create')
  const locale = useLocale()
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const router = useRouter()
  // Aucune présélection : l'élève et la classe se choisissent explicitement (#464).
  const [studentId, setStudentId] = useState<string | null>(defaultStudentId ?? null)
  const [classPeriodId, setClassPeriodId] = useState<string | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const arrival = useEnrollmentArrival(
    paymentsEnabled ? plans.find((plan) => plan.id === planId) : undefined,
    arrivalPeriod(classes, classPeriodId),
    currency
  )
  const selectedStudent = students.find((s) => s.id === studentId)
  // Un élève déjà inscrit sur la période n'est inscriptible qu'en remplaçant l'existante.
  const needsReplace = selectedStudent?.enrolledInPeriod === true && !replaceExisting
  const canSubmit = studentId !== null && classPeriodId !== null && !needsReplace
  const planItems = plans.map((p) => ({ value: p.id, label: p.name }))
  const missingFields = [
    studentId === null && t('selectStudent'),
    classPeriodId === null && t('selectClass'),
  ].filter(Boolean)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (studentId === null || classPeriodId === null || needsReplace) return
    const formData = new FormData(e.currentTarget)
    // Absent quand le sélecteur de formule est masqué (paiements coupés) : `createEnrollment`
    // résout alors la formule réservée elle-même, un `planId` explicite serait refusé.
    const planId = formData.get('planId')

    startTransition(async () => {
      const result = await createEnrollmentAction({
        studentId,
        planId: planId ? (planId as string) : undefined,
        classPeriodId,
        totalAmount: paymentsEnabled ? arrival.totalAmount : undefined,
        ...arrival.input,
        canLeaveAlone: formData.get('canLeaveAlone') === 'on',
        replaceExisting,
      })
      if (typeof result === 'string') {
        toastActionError(t, result)
      } else {
        toast.success(t('success'))
        setOpen(false)
        if (redirectTo) router.push(redirectTo)
      }
    })
  }

  const classSelect = (
    <div className="space-y-2">
      <Label htmlFor="enroll-class">
        {t('selectClass')}
        <RequiredMark />
      </Label>
      <ClassSelect
        id="enroll-class"
        classes={classes}
        value={classPeriodId}
        onValueChange={setClassPeriodId}
        suggestedLevelId={selectedStudent?.suggestedLevelId}
        disabled={isPending || classes.length === 0}
      />
      {classes.length === 0 && <p className="text-xs text-amber-700">{t('noClassInPeriod')}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          {!defaultStudentId && (
            <div className="space-y-2">
              <Label htmlFor="enroll-student">
                {t('selectStudent')}
                <RequiredMark />
              </Label>
              <StudentCombobox
                id="enroll-student"
                students={students}
                value={studentId}
                onValueChange={(id) => {
                  setStudentId(id)
                  setReplaceExisting(false)
                }}
                disabled={isPending}
              />
              <p className="text-xs text-graphite-600">
                {t('newStudentHint')}{' '}
                {onAddStudent ? (
                  <button
                    type="button"
                    className="font-medium underline"
                    disabled={isPending}
                    onClick={() => {
                      setOpen(false)
                      onAddStudent()
                    }}
                  >
                    {t('newStudentLink')}
                  </button>
                ) : (
                  <Link href="/dashboard/students" className="font-medium underline">
                    {t('newStudentLink')}
                  </Link>
                )}
              </p>
            </div>
          )}
          {paymentsEnabled ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {classSelect}
              <div className="space-y-2">
                <Label htmlFor="enroll-plan">
                  {t('selectPlan')}
                  <RequiredMark />
                </Label>
                <Select
                  name="planId"
                  items={planItems}
                  required
                  disabled={isPending}
                  value={planId}
                  onValueChange={(value) => {
                    setPlanId(value ?? '')
                    arrival.changePlan()
                  }}
                >
                  <SelectTrigger id="enroll-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {planItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            classSelect
          )}
          <EnrollmentArrivalFields
            idPrefix="enroll"
            schedule={arrival.schedule}
            currency={currency}
            firstAmount={arrival.firstAmount}
            onStartMonthChange={arrival.changeStartMonth}
            onFirstAmountChange={arrival.changeFirstAmount}
            disabled={isPending}
          />
          {paymentsEnabled && (
            <div className="space-y-2">
              <Label htmlFor="enroll-total-amount">
                {t('totalAmount', { currency: currencySymbol(locale, currency) })}
              </Label>
              <Input
                id="enroll-total-amount"
                name="totalAmount"
                type="number"
                step={currencyStep(currency)}
                min="0"
                value={arrival.totalAmount}
                onChange={(event) => arrival.setTotalAmount(Number(event.target.value))}
                disabled={isPending}
                aria-describedby="enroll-total-amount-hint"
              />
              <p id="enroll-total-amount-hint" className="text-xs text-graphite-600">
                {t('totalAmountHint')}
              </p>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="canLeaveAlone" className="rounded" />
            {t('canLeaveAlone')}
          </label>
          {selectedStudent?.enrolledInPeriod && (
            <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">{t('alreadyEnrolledHint')}</p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="replaceExisting"
                  className="mt-0.5 rounded"
                  checked={replaceExisting}
                  onChange={(event) => setReplaceExisting(event.target.checked)}
                />
                <span>
                  {t('replaceExisting')}
                  <span className="block text-xs text-graphite-600">
                    {t(paymentsEnabled ? 'replaceExistingHint' : 'replaceExistingHintNoPayments')}
                  </span>
                </span>
              </label>
            </div>
          )}
          {missingFields.length > 0 && !isPending && (
            <p className="text-xs text-graphite-600">
              {t('missingFields', { fields: missingFields.join(', ') })}
            </p>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isPending || !canSubmit}>
          {isPending ? '...' : t('submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
