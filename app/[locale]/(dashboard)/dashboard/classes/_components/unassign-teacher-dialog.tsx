'use client'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@peaklab/ui'
import { useTranslations } from 'next-intl'
import { DialogFormActions, useDialogForm } from '@/features/forms'
import { useRouter } from '@/i18n/routing'
import { unassignClassPeriodTeacherAction } from '../../../_lib/class-period-actions'

interface UnassignTeacherDialogProps {
  classPeriodId: string
  teacherId: string
  teacherName: string
}

export function UnassignTeacherDialog({
  classPeriodId,
  teacherId,
  teacherName,
}: UnassignTeacherDialogProps) {
  const t = useTranslations('dashboard.pages.classDetails.unassignTeacher')

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="destructive" size="sm">
          {t('trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title', { teacher: teacherName })}</DialogTitle>
        </DialogHeader>
        <UnassignTeacherForm
          classPeriodId={classPeriodId}
          teacherId={teacherId}
          teacherName={teacherName}
        />
      </DialogContent>
    </Dialog>
  )
}

function UnassignTeacherForm({
  classPeriodId,
  teacherId,
  teacherName,
}: UnassignTeacherDialogProps) {
  const t = useTranslations('dashboard.pages.classDetails.unassignTeacher')
  const router = useRouter()
  const { isPending, close, onSubmit } = useDialogForm(t)

  const handleSubmit = onSubmit(() => unassignClassPeriodTeacherAction(classPeriodId, teacherId), {
    onSuccess: () => router.refresh(),
  })

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <p className="text-sm text-graphite-600">{t('warning', { teacher: teacherName })}</p>
      </DialogBody>
      <DialogFormActions
        t={t}
        isPending={isPending}
        onCancel={close}
        submitKey="confirm"
        submitVariant="destructive"
      />
    </form>
  )
}
