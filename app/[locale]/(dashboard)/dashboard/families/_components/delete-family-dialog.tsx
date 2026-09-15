'use client'

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
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { deleteFamilyAction } from '../../../_lib/family-actions'

/** Ce que la suppression emportera, tel que la page de détail le compte déjà. */
export type FamilyDeletionImpact = {
  members: number
  students: number
  enrollments: number
  payments: number
}

type Props = {
  familyId: string
  familyName: string
  impact: FamilyDeletionImpact
  defaultOpen?: boolean
  redirectTo?: string
  showTrigger?: boolean
}

export function DeleteFamilyDialog({
  familyId,
  familyName,
  impact,
  defaultOpen = false,
  redirectTo,
  showTrigger = true,
}: Props) {
  const t = useTranslations('dashboard.pages.families.delete')

  return (
    <Dialog initialOpen={defaultOpen}>
      <DialogRouteOpener open={defaultOpen} cleanUrl={redirectTo} />
      {showTrigger && (
        <DialogTrigger>
          <Button variant="destructive" size="sm">
            {t('title')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <DeleteFamilyForm familyId={familyId} familyName={familyName} impact={impact} />
      </DialogContent>
    </Dialog>
  )
}

function DeleteFamilyForm({
  familyId,
  familyName,
  impact,
}: Pick<Props, 'familyId' | 'familyName' | 'impact'>) {
  const t = useTranslations('dashboard.pages.families.delete')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [confirmation, setConfirmation] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await deleteFamilyAction(familyId, confirmation)
      if (result !== 'OK') {
        toastActionError(t, result)
        return
      }
      toast.success(t('success'))
      setOpen(false)
      router.push('/dashboard/families')
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="space-y-4">
          <p className="text-sm text-graphite-600">{t('description')}</p>
          <ul className="space-y-1 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <li>{t('impact.members', { count: impact.members })}</li>
            <li>{t('impact.students', { count: impact.students })}</li>
            <li>{t('impact.enrollments', { count: impact.enrollments })}</li>
            <li>{t('impact.payments', { count: impact.payments })}</li>
          </ul>
          <div className="space-y-2">
            <Label htmlFor="delete-family-confirmation">
              {t('confirmationLabel', { name: familyName })}
            </Label>
            <Input
              id="delete-family-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={isPending}
              autoComplete="off"
              required
            />
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={
            isPending || confirmation.trim().toLowerCase() !== familyName.trim().toLowerCase()
          }
        >
          {isPending ? '...' : t('confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
