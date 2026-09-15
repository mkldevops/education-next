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
  Textarea,
} from '@peaklab/ui'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { createStudentAction } from '../../../_lib/student-actions'

interface Option {
  id: string
  name: string
}

interface CreateStudentDialogProps {
  familyId: string
  /** Plans et classes de la période sélectionnée : vides, l'inscription n'est pas proposée. */
  plans?: Option[]
  classes?: Option[]
  defaultOpen?: boolean
  redirectTo?: string
  showTrigger?: boolean
}

export function CreateStudentDialog({
  familyId,
  plans = [],
  classes = [],
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
        <CreateStudentForm familyId={familyId} plans={plans} classes={classes} />
      </DialogContent>
    </Dialog>
  )
}

function CreateStudentForm({
  familyId,
  plans,
  classes,
}: {
  familyId: string
  plans: Option[]
  classes: Option[]
}) {
  const t = useTranslations('dashboard.pages.students.create')
  const { isPending, close, onSubmit } = useDialogForm(t)
  const router = useRouter()
  const canEnroll = plans.length > 0 && classes.length > 0
  const [enroll, setEnroll] = useState(canEnroll)

  const handleSubmit = onSubmit(
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
        ...(enroll && canEnroll
          ? {
              enrollment: {
                planId: formData.get('planId') as string,
                classPeriodId: formData.get('classPeriodId') as string,
                discount: Number(formData.get('discount') || 0),
                canLeaveAlone: formData.get('canLeaveAlone') === 'on',
              },
            }
          : {}),
      }),
    {
      successKey: enroll && canEnroll ? 'successEnrolled' : 'success',
      onSuccess: () => {
        if (familyId) router.push(`/dashboard/families/${familyId}`)
      },
    }
  )

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <input type="hidden" name="familyId" value={familyId} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-name">{t('firstname')}</Label>
              <Input id="student-name" name="name" required maxLength={250} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-lastname">{t('lastname')}</Label>
              <Input
                id="student-lastname"
                name="lastname"
                required
                maxLength={250}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-sex">{t('sex')}</Label>
              <Select id="student-sex" name="sex" disabled={isPending}>
                <option value="">{t('unspecified')}</option>
                <option value="MALE">{t('male')}</option>
                <option value="FEMALE">{t('female')}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-birthday">{t('birthday')}</Label>
              <Input id="student-birthday" name="birthday" type="date" disabled={isPending} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-birthplace">{t('birthplace')}</Label>
              <Input
                id="student-birthplace"
                name="birthplace"
                maxLength={250}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-allergies">{t('allergies')}</Label>
              <Input id="student-allergies" name="allergies" maxLength={250} disabled={isPending} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-health">{t('healthNotes')}</Label>
            <Textarea id="student-health" name="healthNotes" disabled={isPending} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="snackAuthorization" className="rounded" />
            {t('snackAuthorization')}
          </label>

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
                      <Label htmlFor="student-plan">{t('selectPlan')}</Label>
                      <Select id="student-plan" name="planId" required disabled={isPending}>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student-class">{t('selectClass')}</Label>
                      <Select id="student-class" name="classPeriodId" required disabled={isPending}>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-discount">{t('discount')}</Label>
                    <Input
                      id="student-discount"
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
                </>
              )
            ) : (
              <p className="text-amber-700 text-xs">{t('enrollUnavailable')}</p>
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFormActions t={t} isPending={isPending} onCancel={close} />
    </form>
  )
}
