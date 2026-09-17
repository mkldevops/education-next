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
import { useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { toast, toastActionError } from '@/lib/toast'
import { deactivateStudentAction } from '../../../_lib/student-actions'

type Props = {
  studentId: string
  triggerRole?: React.AriaRole
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

export function DeactivateStudentButton({ studentId, triggerRole }: Props) {
  const t = useTranslations('dashboard.pages.students.deactivate')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="destructive" size="sm" role={triggerRole}>
          {t('title')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <DeactivateForm studentId={studentId} />
      </DialogContent>
    </Dialog>
  )
}

function DeactivateForm({ studentId }: { studentId: string }) {
  const t = useTranslations('dashboard.pages.students.deactivate')
  const { setOpen } = useDialog()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await deactivateStudentAction(studentId)
      if (result === 'hasActiveEnrollments') {
        toast.error(t('hasEnrollments'))
      } else if (result !== 'OK') {
        toastActionError(t, result)
      } else {
        toast.success(t('success'))
        setOpen(false)
        router.push('/dashboard/students')
      }
    })
  }

  return (
    <form onSubmit={handleConfirm}>
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('description')}</p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? '...' : t('confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
