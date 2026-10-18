'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRouteOpener,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, RequiredMark, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { ClassSelect } from '../../../_components/class-select'
import type { ClassOption } from '../../../_lib/class-options'
import { createStudentAction } from '../../../_lib/student-actions'

interface Option {
  id: string
  name: string
  amount?: number
}

interface CreateStudentDialogProps {
  familyId: string
  /** Nom de la famille, proposé comme nom de l'élève (modifiable). */
  familyName?: string
  /** Plans et classes de la période sélectionnée : vides, l'inscription n'est pas proposée. */
  plans?: Option[]
  classes?: ClassOption[]
  /** Faux, l'inscription immédiate se fait sans formule ni remise. */
  paymentsEnabled: boolean
  defaultOpen?: boolean
  redirectTo?: string
  showTrigger?: boolean
}

export function CreateStudentDialog({
  familyId,
  familyName,
  plans = [],
  classes = [],
  paymentsEnabled,
  defaultOpen = false,
  redirectTo,
  showTrigger = true,
}: CreateStudentDialogProps) {
  const t = useTranslations('dashboard.pages.students.create')
  const routeAfterOpen = redirectTo ?? `/dashboard/families/${familyId}`

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={routeAfterOpen} />
      {showTrigger && (
        <DialogTrigger>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {t('title')}
          </Button>
        </DialogTrigger>
      )}
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
        />
      </DialogContent>
    </Dialog>
  )
}

function CreateStudentForm({
  familyId,
  familyName,
  plans,
  classes,
  paymentsEnabled,
}: {
  familyId: string
  familyName?: string
  plans: Option[]
  classes: ClassOption[]
  paymentsEnabled: boolean
}) {
  const t = useTranslations('dashboard.pages.students.create')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()
  // Sans formule à choisir, l'inscription reste possible hors drapeau : seule la classe
  // est nécessaire.
  const canEnroll = classes.length > 0 && (!paymentsEnabled || plans.length > 0)
  const [enroll, setEnroll] = useState(canEnroll)
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const [totalAmount, setTotalAmount] = useState(plans[0]?.amount ?? 0)
  const sexItems = [
    { value: null, label: t('unspecified') },
    { value: 'MALE', label: t('male') },
    { value: 'FEMALE', label: t('female') },
  ]
  // Aucune classe présélectionnée : elle se choisit explicitement (#464).
  const [classPeriodId, setClassPeriodId] = useState<string | null>(null)
  const enrolling = enroll && canEnroll
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
                      totalAmount,
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
        if (familyId) router.push(`/dashboard/families/${familyId}`)
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
              <Input id="student-name" name="name" required maxLength={250} disabled={isPending} />
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
                            const nextPlanId = value ?? ''
                            const selected = plans.find((plan) => plan.id === nextPlanId)
                            setPlanId(nextPlanId)
                            setTotalAmount(selected?.amount ?? 0)
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
                  </div>
                  {paymentsEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="student-total-amount">{t('totalAmount')}</Label>
                      <Input
                        id="student-total-amount"
                        name="totalAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={totalAmount}
                        onChange={(event) => setTotalAmount(Number(event.target.value))}
                        disabled={isPending}
                      />
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
