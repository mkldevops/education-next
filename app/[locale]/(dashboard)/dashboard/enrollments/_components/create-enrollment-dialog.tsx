'use client'

import type { ButtonProps } from '@peaklab/ui'
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
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
  useDialog,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { createEnrollmentAction } from '../../../_lib/enrollment-actions'
import type { ClassOption, StudentOption } from '../_lib/enrollment-options'
import { ClassSelect } from './class-select'
import { StudentCombobox } from './student-combobox'

interface PlanOption {
  id: string
  name: string
  amount?: number
}

interface CreateEnrollmentDialogProps {
  students: StudentOption[]
  plans: PlanOption[]
  classes: ClassOption[]
  paymentsEnabled: boolean
  defaultOpen?: boolean
  defaultStudentId?: string
  redirectTo?: string
  showTrigger?: boolean
  triggerSize?: ButtonProps['size']
}

export function CreateEnrollmentDialog({
  students,
  plans,
  classes,
  paymentsEnabled,
  defaultOpen = false,
  defaultStudentId,
  redirectTo,
  showTrigger = true,
  triggerSize,
}: CreateEnrollmentDialogProps) {
  const t = useTranslations('dashboard.pages.enrollments.create')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo ?? '/dashboard/enrollments'} />
      {showTrigger && (
        <DialogTrigger>
          <Button size={triggerSize}>
            <Plus className="h-4 w-4" />
            {t('title')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <CreateEnrollmentForm
          students={students}
          plans={plans}
          classes={classes}
          paymentsEnabled={paymentsEnabled}
          defaultStudentId={defaultStudentId}
          redirectTo={redirectTo}
        />
      </DialogContent>
    </Dialog>
  )
}

type CreateEnrollmentFormProps = Pick<
  CreateEnrollmentDialogProps,
  'students' | 'plans' | 'classes' | 'paymentsEnabled' | 'defaultStudentId' | 'redirectTo'
>

function CreateEnrollmentForm({
  students,
  plans,
  classes,
  paymentsEnabled,
  defaultStudentId,
  redirectTo,
}: CreateEnrollmentFormProps) {
  const t = useTranslations('dashboard.pages.enrollments.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const [totalAmount, setTotalAmount] = useState(plans[0]?.amount ?? 0)
  const router = useRouter()
  // Aucune présélection : l'élève et la classe se choisissent explicitement (#464).
  const [studentId, setStudentId] = useState<string | null>(defaultStudentId ?? null)
  const [classPeriodId, setClassPeriodId] = useState<string | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const selectedStudent = students.find((s) => s.id === studentId)
  // Un élève déjà inscrit sur la période n'est inscriptible qu'en remplaçant l'existante.
  const needsReplace = selectedStudent?.enrolledInPeriod === true && !replaceExisting
  const canSubmit = studentId !== null && classPeriodId !== null && !needsReplace
  const planItems = plans.map((p) => ({ value: p.id, label: p.name }))

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
        totalAmount: paymentsEnabled ? totalAmount : undefined,
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
      <Label htmlFor="enroll-class">{t('selectClass')}</Label>
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
              <Label htmlFor="enroll-student">{t('selectStudent')}</Label>
              <StudentCombobox
                id="enroll-student"
                students={students}
                value={studentId}
                onValueChange={setStudentId}
                disabled={isPending}
              />
              {selectedStudent?.enrolledInPeriod && (
                <p className="text-xs text-amber-700">{t('alreadyEnrolledHint')}</p>
              )}
            </div>
          )}
          {paymentsEnabled ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="enroll-plan">{t('selectPlan')}</Label>
                <Select
                  name="planId"
                  items={planItems}
                  required
                  disabled={isPending}
                  value={planId}
                  onValueChange={(value) => {
                    const selected = plans.find((plan) => plan.id === value)
                    setPlanId(value ?? '')
                    setTotalAmount(selected?.amount ?? 0)
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
              {classSelect}
            </div>
          ) : (
            classSelect
          )}
          {paymentsEnabled && (
            <div className="space-y-2">
              <Label htmlFor="enroll-total-amount">{t('totalAmount')}</Label>
              <Input
                id="enroll-total-amount"
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="canLeaveAlone" className="rounded" />
            {t('canLeaveAlone')}
          </label>
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
