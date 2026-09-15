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
  useDialog,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { createEnrollmentAction } from '../../../_lib/enrollment-actions'

interface Option {
  id: string
  name: string
}

interface CreateEnrollmentDialogProps {
  students: Option[]
  plans: Option[]
  classes: Option[]
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
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo} />
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
          defaultOpen={defaultOpen}
          defaultStudentId={defaultStudentId}
          redirectTo={redirectTo}
        />
      </DialogContent>
    </Dialog>
  )
}

function CreateEnrollmentForm({
  students,
  plans,
  classes,
  paymentsEnabled,
  defaultOpen = false,
  defaultStudentId,
  redirectTo,
}: CreateEnrollmentDialogProps) {
  const t = useTranslations('dashboard.pages.enrollments.create')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true)
      router.replace(redirectTo ?? '/dashboard/enrollments')
    }
  }, [defaultOpen, setOpen, router, redirectTo])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    // Absent quand le sélecteur de formule est masqué (paiements coupés) : `createEnrollment`
    // résout alors la formule réservée elle-même, un `planId` explicite serait refusé.
    const planId = formData.get('planId')

    startTransition(async () => {
      const result = await createEnrollmentAction({
        studentId: formData.get('studentId') as string,
        planId: planId ? (planId as string) : undefined,
        classPeriodId: formData.get('classPeriodId') as string,
        discount: Number(formData.get('discount') || 0),
        canLeaveAlone: formData.get('canLeaveAlone') === 'on',
        replaceExisting: formData.get('replaceExisting') === 'on',
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
      <Select
        id="enroll-class"
        name="classPeriodId"
        required
        disabled={isPending || classes.length === 0}
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      {classes.length === 0 && <p className="text-xs text-amber-700">{t('noClassInPeriod')}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          {defaultStudentId ? (
            <input type="hidden" name="studentId" value={defaultStudentId} />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="enroll-student">{t('selectStudent')}</Label>
              <Select id="enroll-student" name="studentId" required disabled={isPending}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {paymentsEnabled ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="enroll-plan">{t('selectPlan')}</Label>
                <Select id="enroll-plan" name="planId" required disabled={isPending}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              {classSelect}
            </div>
          ) : (
            classSelect
          )}
          {paymentsEnabled && (
            <div className="space-y-2">
              <Label htmlFor="enroll-discount">{t('discount')}</Label>
              <Input
                id="enroll-discount"
                name="discount"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                disabled={isPending}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="canLeaveAlone" className="rounded" />
            {t('canLeaveAlone')}
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="replaceExisting" className="mt-0.5 rounded" />
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
        <Button type="submit" disabled={isPending || classes.length === 0}>
          {isPending ? '...' : t('submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}
