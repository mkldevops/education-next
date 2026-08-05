'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRouteOpener,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@/components/ui/dialog/dialog'
import { Input, Label } from '@/components/ui/input/input'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { createEnrollmentAction } from '../../../_lib/enrollment-actions'

interface Option {
  id: string
  name: string
}

interface CreateEnrollmentDialogProps {
  students: Option[]
  plans: Option[]
  classes: Option[]
  defaultOpen?: boolean
  defaultStudentId?: string
  redirectTo?: string
  showTrigger?: boolean
}

export function CreateEnrollmentDialog({
  students,
  plans,
  classes,
  defaultOpen = false,
  defaultStudentId,
  redirectTo,
  showTrigger = true,
}: CreateEnrollmentDialogProps) {
  const t = useTranslations('dashboard.pages.enrollments.create')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo} />
      {showTrigger && (
        <DialogTrigger>
          <Button>+ {t('title')}</Button>
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

    startTransition(async () => {
      const result = await createEnrollmentAction({
        studentId: formData.get('studentId') as string,
        planId: formData.get('planId') as string,
        classPeriodId: formData.get('classPeriodId') as string,
        discount: Number(formData.get('discount') || 0),
        canLeaveAlone: formData.get('canLeaveAlone') === 'on',
      })
      if (typeof result === 'string') {
        toast.error(t('error'))
      } else {
        toast.success(t('success'))
        setOpen(false)
        if (redirectTo) router.push(redirectTo)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          {defaultStudentId ? (
            <input type="hidden" name="studentId" value={defaultStudentId} />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="enroll-student">{t('selectStudent')}</Label>
              <select
                id="enroll-student"
                name="studentId"
                required
                disabled={isPending}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="enroll-plan">{t('selectPlan')}</Label>
              <select
                id="enroll-plan"
                name="planId"
                required
                disabled={isPending}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enroll-class">{t('selectClass')}</Label>
              <select
                id="enroll-class"
                name="classPeriodId"
                required
                disabled={isPending || classes.length === 0}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {classes.length === 0 && (
                <p className="text-xs text-amber-700">{t('noClassInPeriod')}</p>
              )}
            </div>
          </div>
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="canLeaveAlone" className="rounded" />
            {t('canLeaveAlone')}
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
