'use client'

import {
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@peaklab/ui'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, RequiredMark, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { currencyStep, currencySymbol } from '@/lib/decimal'
import { ClassSelect } from '../../../_components/class-select'
import {
  EnrollmentArrivalFields,
  useEnrollmentArrival,
} from '../../../_components/enrollment-arrival-fields'
import { arrivalPeriod } from '../../../_lib/arrival-schedule'
import type { ClassOption } from '../../../_lib/class-options'
import type { PlanOption } from '../../../_lib/plan-options'
import { createStudentAction } from '../../../_lib/student-actions'

/**
 * Formulaire de création d'élève, chargé à la première ouverture du dialogue : il ne pèse pas
 * sur les pages qui n'affichent que son bouton.
 */
export function CreateStudentDialogContent({
  familyId,
  familyName,
  plans,
  classes,
  paymentsEnabled,
  currency,
  afterCreateHref,
}: Parameters<typeof CreateStudentForm>[0]) {
  const t = useTranslations('dashboard.pages.students.create')

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
      </DialogHeader>
      <CreateStudentForm
        familyId={familyId}
        familyName={familyName}
        plans={plans}
        classes={classes}
        paymentsEnabled={paymentsEnabled}
        currency={currency}
        afterCreateHref={afterCreateHref}
      />
    </DialogContent>
  )
}

function CreateStudentForm({
  familyId,
  familyName,
  plans,
  classes,
  paymentsEnabled,
  currency,
  afterCreateHref,
}: {
  familyId: string
  familyName?: string
  plans: PlanOption[]
  classes: ClassOption[]
  paymentsEnabled: boolean
  currency: string
  afterCreateHref?: string
}) {
  const t = useTranslations('dashboard.pages.students.create')
  const locale = useLocale()
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()
  // Sans formule à choisir, l'inscription reste possible hors drapeau : seule la classe
  // est nécessaire.
  const canEnroll = classes.length > 0 && (!paymentsEnabled || plans.length > 0)
  const [enroll, setEnroll] = useState(canEnroll)
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const sexItems = [
    { value: null, label: t('unspecified') },
    { value: 'MALE', label: t('male') },
    { value: 'FEMALE', label: t('female') },
  ]
  // Aucune classe présélectionnée : elle se choisit explicitement (#464).
  const [classPeriodId, setClassPeriodId] = useState<string | null>(null)
  const enrolling = enroll && canEnroll
  const arrival = useEnrollmentArrival(
    paymentsEnabled && enrolling ? plans.find((plan) => plan.id === planId) : undefined,
    arrivalPeriod(classes, classPeriodId),
    currency
  )
  const missingClass = enrolling && classPeriodId === null
  const planItems = plans.map((p) => ({ value: p.id, label: p.name }))

  const submit = onSubmit(
    (formData) =>
      createStudentAction({
        familyId: formData.get('familyId') as string,
        person: {
          name: formData.get('name') as string,
          lastname: formData.get('lastname') as string,
          sex: (formData.get('sex') as 'MALE' | 'FEMALE' | '') || undefined,
        },
        student: {
          birthday: formData.get('birthday')
            ? new Date(formData.get('birthday') as string)
            : undefined,
          birthplace: (formData.get('birthplace') as string) || undefined,
          allergies: (formData.get('allergies') as string) || undefined,
          healthNotes: (formData.get('healthNotes') as string) || undefined,
          snackAuthorization: formData.get('snackAuthorization') === 'on',
        },
        ...(enrolling && classPeriodId
          ? {
              enrollment: {
                // Hors drapeau les deux champs n'existent pas : les omettre laisse le use
                // case résoudre la formule réservée et écrire zéro (FR-017).
                ...(paymentsEnabled
                  ? {
                      planId,
                      totalAmount: arrival.totalAmount,
                      ...arrival.input,
                    }
                  : {}),
                classPeriodId,
                canLeaveAlone: formData.get('canLeaveAlone') === 'on',
              },
            }
          : {}),
      }),
    {
      successKey: enrolling ? 'successEnrolled' : 'success',
      onSuccess: () => {
        if (afterCreateHref) router.push(afterCreateHref)
        else if (familyId) router.push(`/dashboard/families/${familyId}`)
      },
    }
  )

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (missingClass) {
      event.preventDefault()
      return
    }
    submit(event)
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <input type="hidden" name="familyId" value={familyId} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-name">
                {t('firstname')}
                <RequiredMark />
              </Label>
              <Input
                id="student-name"
                name="name"
                required
                maxLength={250}
                disabled={isPending}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-lastname">
                {t('lastname')}
                <RequiredMark />
              </Label>
              <Input
                id="student-lastname"
                name="lastname"
                defaultValue={familyName}
                required
                maxLength={250}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-sex">{t('sex')}</Label>
              <Select name="sex" items={sexItems} disabled={isPending} defaultValue={null}>
                <SelectTrigger id="student-sex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sexItems.map((item) => (
                    <SelectItem key={item.value ?? ''} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-birthday">{t('birthday')}</Label>
              <Input id="student-birthday" name="birthday" type="date" disabled={isPending} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-birthplace">{t('birthplace')}</Label>
            <Input id="student-birthplace" name="birthplace" maxLength={250} disabled={isPending} />
          </div>
          {/* Repliée par défaut : un <details> fermé soumet quand même ses champs. */}
          <details className="rounded border border-graphite-200 p-3">
            <summary className="cursor-pointer font-medium text-sm">{t('healthSection')}</summary>
            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student-allergies">{t('allergies')}</Label>
                <Input
                  id="student-allergies"
                  name="allergies"
                  maxLength={250}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-health">{t('healthNotes')}</Label>
                <Textarea id="student-health" name="healthNotes" disabled={isPending} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="snackAuthorization" className="rounded" />
                {t('snackAuthorization')}
              </label>
            </div>
          </details>

          <div className="space-y-3 border-graphite-200 border-t pt-4">
            <label className="flex items-center gap-2 font-medium text-sm">
              <input
                type="checkbox"
                name="enroll"
                className="rounded"
                checked={enroll}
                onChange={(e) => setEnroll(e.target.checked)}
                disabled={isPending || !canEnroll}
              />
              {t('enrollNow')}
            </label>
            {canEnroll ? (
              enroll && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="student-class">
                        {t('selectClass')}
                        <RequiredMark />
                      </Label>
                      <ClassSelect
                        id="student-class"
                        classes={classes}
                        value={classPeriodId}
                        onValueChange={setClassPeriodId}
                        disabled={isPending}
                      />
                    </div>
                    {/* Ni formule ni remise quand l'école ne tarife pas : le use case les
                        refuserait, et les proposer ferait croire à un choix. */}
                    {paymentsEnabled && (
                      <div className="space-y-2">
                        <Label htmlFor="student-plan">
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
                          <SelectTrigger id="student-plan">
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
                    )}
                  </div>
                  <EnrollmentArrivalFields
                    idPrefix="student"
                    schedule={arrival.schedule}
                    currency={currency}
                    firstAmount={arrival.firstAmount}
                    onStartMonthChange={arrival.changeStartMonth}
                    onFirstAmountChange={arrival.changeFirstAmount}
                    disabled={isPending}
                  />
                  {paymentsEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="student-total-amount">
                        {t('totalAmount', { currency: currencySymbol(locale, currency) })}
                      </Label>
                      <Input
                        id="student-total-amount"
                        name="totalAmount"
                        type="number"
                        step={currencyStep(currency)}
                        min="0"
                        value={arrival.totalAmount}
                        onChange={(event) => arrival.setTotalAmount(Number(event.target.value))}
                        disabled={isPending}
                        aria-describedby="student-total-amount-hint"
                      />
                      <p id="student-total-amount-hint" className="text-graphite-600 text-xs">
                        {t('totalAmountHint')}
                      </p>
                    </div>
                  )}
                  {/* canLeaveAlone appartient à l'inscription (Enrollment), pas à l'élève :
                      il reste ici, libellé comme valant pour cette inscription. */}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="canLeaveAlone" className="rounded" />
                    {t('canLeaveAlone')}
                  </label>
                </>
              )
            ) : (
              <p className="text-amber-700 text-xs">{t('enrollUnavailable')}</p>
            )}
            {missingClass && !isPending && (
              <p className="text-graphite-600 text-xs">
                {t('missingFields', { fields: t('selectClass') })}
              </p>
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitDisabled={missingClass}
      />
    </form>
  )
}
