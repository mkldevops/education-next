'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import type { DeactivationBlockers } from '@/domain/school-deactivation'
import { toast, toastActionError } from '@/lib/toast'
import {
  deactivateSchoolAction,
  reactivateSchoolAction,
  updateSchoolAction,
} from '../../../_lib/school-admin-actions'
import { readSchoolIdentity, SchoolIdentityFields } from './school-identity-fields'

type School = {
  id: string
  name: string
  slug: string
  address: string
  postCode: string
  city: string
  isActive: boolean
}

type Props = {
  school: School
  /**
   * Compté à l'affichage : la garde qui fait foi est celle du gateway, sous verrou.
   * Ce drapeau ne fait qu'éviter de proposer une action déjà condamnée.
   */
  isLastActive: boolean
}

export function EditSchoolDialog(props: Props) {
  const t = useTranslations('schools.admin.edit')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditSchoolForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function EditSchoolForm({ school, isLastActive }: Props) {
  const t = useTranslations('schools.admin.edit')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const [blockers, setBlockers] = useState<DeactivationBlockers | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await updateSchoolAction({ id: school.id, ...readSchoolIdentity(formData) })
      if (result !== 'OK') {
        toastActionError(t, result)
        return
      }
      toast.success(t('success'))
      setOpen(false)
    })
  }

  const handleDeactivate = () => {
    setBlockers(null)
    startTransition(async () => {
      const result = await deactivateSchoolAction(school.id)
      if (result.status === 'schoolInUse') {
        setBlockers(result.blockers)
        return
      }
      if (result.status !== 'OK') {
        toastActionError(t, result.status)
        return
      }
      toast.success(t('deactivateSuccess'))
      setOpen(false)
    })
  }

  const handleReactivate = () => {
    startTransition(async () => {
      const result = await reactivateSchoolAction(school.id)
      if (result !== 'OK') {
        toastActionError(t, result)
        return
      }
      toast.success(t('reactivateSuccess'))
      setOpen(false)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <SchoolIdentityFields idPrefix="edit-school" disabled={isPending} defaults={school} />
        {blockers && <BlockerList blockers={blockers} />}
      </DialogBody>
      <DialogFooter className="justify-between">
        {school.isActive ? (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeactivate}
            disabled={isPending || isLastActive}
            title={isLastActive ? t('errors.lastActiveSchool') : undefined}
          >
            {t('deactivate')}
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={handleReactivate} disabled={isPending}>
            {t('reactivate')}
          </Button>
        )}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? '...' : t('submit')}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

function BlockerList({ blockers }: { blockers: DeactivationBlockers }) {
  const t = useTranslations('schools.admin.edit.blockers')

  const lines = (
    [
      ['enrollments', blockers.pendingEnrollments],
      ['transactions', blockers.pendingTransactions],
      ['invitations', blockers.pendingInvitations],
    ] as const
  ).filter(([, count]) => count > 0)

  return (
    <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-900">{t('title')}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
        {lines.map(([key, count]) => (
          <li key={key}>{t(key, { count })}</li>
        ))}
      </ul>
    </div>
  )
}
